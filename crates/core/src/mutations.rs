use crate::{files, model::*, title, valid_id, Database, Error, Result};
use rusqlite::{params, Connection};
use std::collections::HashSet;
const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
fn changed(count: usize) -> Result<()> {
    if count == 0 {
        return Err(Error::Invalid(
            "This item no longer exists. Reload and try again.".into(),
        ));
    }
    Ok(())
}
fn ids(conn: &Connection, sql: &str, args: impl rusqlite::Params) -> Result<Vec<String>> {
    Ok(conn
        .prepare(sql)?
        .query_map(args, |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?)
}
fn same_members(current: &[String], requested: &[String]) -> Result<()> {
    let a: HashSet<_> = current.iter().collect();
    let b: HashSet<_> = requested.iter().collect();
    if a != b || current.len() != requested.len() || requested.len() != b.len() {
        return Err(Error::Invalid(
            "The order changed. Please try again.".into(),
        ));
    }
    Ok(())
}
fn positions(
    conn: &Connection,
    table: &str,
    column: &str,
    ordered: &[String],
    slots: Option<&[i64]>,
) -> Result<()> {
    let mut statement = conn.prepare(&format!(
        "UPDATE {table} SET {column}=?1,updated_at={NOW} WHERE id=?2"
    ))?;
    for (i, id) in ordered.iter().enumerate() {
        statement.execute(params![slots.map_or(i as i64, |v| v[i]), id])?;
    }
    Ok(())
}
fn normalize_tasks(conn: &Connection, list_id: &str) -> Result<()> {
    let all = ids(
        conn,
        "SELECT id FROM tasks WHERE list_id=?1 ORDER BY position,id",
        [list_id],
    )?;
    positions(conn, "tasks", "position", &all, None)?;
    let done = ids(
        conn,
        "SELECT id FROM tasks WHERE list_id=?1 AND is_completed=1 ORDER BY completed_position,id",
        [list_id],
    )?;
    positions(conn, "tasks", "completed_position", &done, None)
}
fn normalize_lists(conn: &Connection) -> Result<()> {
    let all = ids(
        conn,
        "SELECT id FROM lists ORDER BY is_default DESC,position,id",
        [],
    )?;
    positions(conn, "lists", "position", &all, None)
}
fn task_list(conn: &Connection, id: &str) -> Result<String> {
    Ok(conn.query_row("SELECT list_id FROM tasks WHERE id=?1", [id], |r| r.get(0))?)
}
impl Database {
    pub fn apply(&mut self, mutation: Mutation) -> Result<Snapshot> {
        if let Mutation::DuplicateTask { id, new_id } = mutation {
            return self.duplicate(&id, &new_id);
        }
        let tx = self.conn.transaction()?;
        match mutation {
            Mutation::CreateList { id, name } => {
                valid_id(&id)?;
                tx.execute("INSERT INTO lists(id,name,position) VALUES(?1,?2,(SELECT COUNT(*) FROM lists))",params![id,title(&name)?])?;
            }
            Mutation::RenameList { id, name } => {
                changed(tx.execute(
                    &format!("UPDATE lists SET name=?1,updated_at={NOW} WHERE id=?2"),
                    params![title(&name)?, id],
                )?)?;
            }
            Mutation::DeleteList { id } => {
                let default: bool =
                    tx.query_row("SELECT is_default FROM lists WHERE id=?1", [&id], |r| {
                        r.get(0)
                    })?;
                if default {
                    return Err(Error::Invalid(
                        "The default Tasks list cannot be deleted.".into(),
                    ));
                }
                changed(tx.execute("DELETE FROM lists WHERE id=?1", [id])?)?;
                normalize_lists(&tx)?;
            }
            Mutation::ReorderLists { ids: requested } => {
                let current = ids(
                    &tx,
                    "SELECT id FROM lists WHERE is_default=0 ORDER BY position,id",
                    [],
                )?;
                same_members(&current, &requested)?;
                let slots: Vec<i64> = (1..=requested.len() as i64).collect();
                positions(&tx, "lists", "position", &requested, Some(&slots))?;
            }
            Mutation::CreateTask {
                id,
                list_id,
                title: value,
            } => {
                valid_id(&id)?;
                tx.execute("INSERT INTO tasks(id,list_id,title,position) VALUES(?1,?2,?3,(SELECT COUNT(*) FROM tasks WHERE list_id=?2))",params![id,list_id,title(&value)?])?;
            }
            Mutation::UpdateTask {
                id,
                title: value,
                notes,
                important,
            } => {
                if notes.as_ref().is_some_and(|v| v.len() > 1_000_000) {
                    return Err(Error::Invalid("Notes must be under 1 MB of text.".into()));
                }
                let value = value.map(|v| title(&v)).transpose()?;
                changed(tx.execute(&format!("UPDATE tasks SET title=COALESCE(?1,title),notes=COALESCE(?2,notes),is_important=COALESCE(?3,is_important),updated_at={NOW} WHERE id=?4"),params![value,notes,important,id])?)?;
            }
            Mutation::CompleteTask { id, completed } => {
                let list_id = task_list(&tx, &id)?;
                changed(tx.execute(&format!("UPDATE tasks SET completed_position=CASE WHEN ?1=1 AND is_completed=0 THEN (SELECT COUNT(*) FROM tasks WHERE list_id=?2 AND is_completed=1) ELSE completed_position END,completed_at=CASE WHEN ?1=1 THEN COALESCE(completed_at,{NOW}) ELSE NULL END,is_completed=?1,updated_at={NOW} WHERE id=?3"),params![completed,list_id,id])?)?;
                normalize_tasks(&tx, &list_id)?;
            }
            Mutation::DeleteTask { id } => {
                let list_id = task_list(&tx, &id)?;
                changed(tx.execute("DELETE FROM tasks WHERE id=?1", [id])?)?;
                normalize_tasks(&tx, &list_id)?;
            }
            Mutation::MoveTask { id, list_id } => {
                let old = task_list(&tx, &id)?;
                if old != list_id {
                    tx.execute(&format!("UPDATE tasks SET list_id=?1,position=(SELECT COUNT(*) FROM tasks WHERE list_id=?1),completed_position=(SELECT COUNT(*) FROM tasks WHERE list_id=?1 AND is_completed=1),updated_at={NOW} WHERE id=?2"),params![list_id,id])?;
                    normalize_tasks(&tx, &old)?;
                    normalize_tasks(&tx, &list_id)?;
                }
            }
            Mutation::ReorderTasks {
                list_id,
                completed,
                ids: requested,
            } => {
                let column = if completed {
                    "completed_position"
                } else {
                    "position"
                };
                let current=ids(&tx,&format!("SELECT id FROM tasks WHERE list_id=?1 AND is_completed=?2 ORDER BY {column},id"),params![list_id,completed])?;
                same_members(&current, &requested)?;
                // Completed tasks retain their saved active slots. Only active slots exchange owners.
                let slots:Vec<i64>=tx.prepare(&format!("SELECT {column} FROM tasks WHERE list_id=?1 AND is_completed=?2 ORDER BY {column},id"))?.query_map(params![list_id,completed],|r|r.get(0))?.collect::<std::result::Result<_,_>>()?;
                positions(&tx, "tasks", column, &requested, Some(&slots))?;
                normalize_tasks(&tx, &list_id)?;
            }
            Mutation::CreateStep {
                id,
                task_id,
                title: value,
            } => {
                valid_id(&id)?;
                tx.execute("INSERT INTO steps(id,task_id,title,position) VALUES(?1,?2,?3,(SELECT COUNT(*) FROM steps WHERE task_id=?2))",params![id,task_id,title(&value)?])?;
            }
            Mutation::UpdateStep {
                id,
                title: value,
                completed,
            } => {
                let value = value.map(|v| title(&v)).transpose()?;
                changed(tx.execute(&format!("UPDATE steps SET title=COALESCE(?1,title),is_completed=COALESCE(?2,is_completed),updated_at={NOW} WHERE id=?3"),params![value,completed,id])?)?;
            }
            Mutation::DeleteStep { id } => {
                let task_id: String =
                    tx.query_row("SELECT task_id FROM steps WHERE id=?1", [&id], |r| r.get(0))?;
                changed(tx.execute("DELETE FROM steps WHERE id=?1", [id])?)?;
                let all = ids(
                    &tx,
                    "SELECT id FROM steps WHERE task_id=?1 ORDER BY position,id",
                    [task_id],
                )?;
                positions(&tx, "steps", "position", &all, None)?;
            }
            Mutation::ReorderSteps {
                task_id,
                ids: requested,
            } => {
                let current = ids(
                    &tx,
                    "SELECT id FROM steps WHERE task_id=?1 ORDER BY position,id",
                    [task_id],
                )?;
                same_members(&current, &requested)?;
                positions(&tx, "steps", "position", &requested, None)?;
            }
            Mutation::DeleteAttachment { id } => {
                changed(tx.execute("DELETE FROM attachments WHERE id=?1", [id])?)?;
            }
            Mutation::DuplicateTask { .. } => unreachable!(),
        }
        tx.commit()?;
        self.snapshot_with_cleanup()
    }
    fn duplicate(&mut self, id: &str, new_id: &str) -> Result<Snapshot> {
        valid_id(new_id)?;
        let snapshot = self.snapshot()?;
        let task = snapshot
            .tasks
            .iter()
            .find(|t| t.id == id)
            .ok_or_else(|| Error::Invalid("This task no longer exists.".into()))?;
        let mut copies = Vec::new();
        let result = (|| -> Result<()> {
            for attachment in snapshot.attachments.iter().filter(|a| a.task_id == id) {
                let bytes = self.read_image(&attachment.stored_path)?;
                let (_, ext) = files::validate_image(&bytes)?;
                let copy_id = uuid::Uuid::new_v4().to_string();
                let name = format!("{copy_id}.{ext}");
                files::write_new(&self.image_dir.join(&name), &bytes)?;
                copies.push((copy_id, name, attachment));
            }
            let tx = self.conn.transaction()?;
            tx.execute("INSERT INTO tasks(id,list_id,title,notes,is_important,position) VALUES(?1,?2,?3,?4,?5,(SELECT COUNT(*) FROM tasks WHERE list_id=?2))",params![new_id,task.list_id,task.title,task.notes,task.is_important])?;
            for step in snapshot.steps.iter().filter(|s| s.task_id == id) {
                tx.execute("INSERT INTO steps(id,task_id,title,is_completed,position) VALUES(?1,?2,?3,?4,?5)",params![uuid::Uuid::new_v4().to_string(),new_id,step.title,step.is_completed,step.position])?;
            }
            for (copy_id, name, original) in &copies {
                tx.execute("INSERT INTO attachments(id,task_id,file_name,stored_path,mime_type,file_size) VALUES(?1,?2,?3,?4,?5,?6)",params![copy_id,new_id,original.file_name,name,original.mime_type,original.file_size])?;
            }
            tx.commit()?;
            Ok(())
        })();
        if let Err(error) = result {
            for (_, name, _) in copies {
                let _ = std::fs::remove_file(self.image_dir.join(name));
            }
            return Err(error);
        }
        self.snapshot_with_cleanup()
    }
}
