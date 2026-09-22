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
    let parents: Vec<Option<String>> = conn.prepare("SELECT DISTINCT parent_id FROM tasks WHERE list_id=?1")?
        .query_map([list_id], |r| r.get(0))?.collect::<std::result::Result<_, _>>()?;
    for parent in parents {
        let all = ids(conn, "SELECT id FROM tasks WHERE list_id=?1 AND parent_id IS ?2 ORDER BY position,id", params![list_id,parent])?;
        positions(conn, "tasks", "position", &all, None)?;
        let done = ids(conn, "SELECT id FROM tasks WHERE list_id=?1 AND parent_id IS ?2 AND is_completed=1 ORDER BY completed_position,id", params![list_id,parent])?;
        positions(conn, "tasks", "completed_position", &done, None)?;
    }
    Ok(())
}
fn place_task(conn: &Connection, id: &str, list_id: &str, parent_id: Option<&str>, before_id: Option<&str>) -> Result<()> {
    let old = task_list(conn, id)?;
    let completed: bool = conn.query_row("SELECT is_completed FROM tasks WHERE id=?1", [id], |r| r.get(0))?;
    if let Some(parent) = parent_id {
        if task_list(conn, parent)? != list_id {
            return Err(Error::Invalid("The parent belongs to a different list.".into()));
        }
        let cycle: bool = conn.query_row("WITH RECURSIVE tree(id) AS (SELECT ?1 UNION ALL SELECT t.id FROM tasks t JOIN tree p ON t.parent_id=p.id) SELECT EXISTS(SELECT 1 FROM tree WHERE id=?2)", params![id,parent], |r| r.get(0))?;
        if cycle { return Err(Error::Invalid("A task cannot be moved into itself or its subtasks.".into())); }
    }
    if let Some(before) = before_id {
        let valid: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM tasks WHERE id=?1 AND id<>?2 AND list_id=?3 AND parent_id IS ?4 AND (?4 IS NOT NULL OR is_completed=?5))", params![before,id,list_id,parent_id,completed], |r| r.get(0))?;
        if !valid { return Err(Error::Invalid("The destination changed. Please try again.".into())); }
    }
    conn.execute(&format!("UPDATE tasks SET parent_id=?1,position=(SELECT COALESCE(MAX(position),-1)+1 FROM tasks WHERE list_id=?2 AND parent_id IS ?1),completed_position=(SELECT COALESCE(MAX(completed_position),-1)+1 FROM tasks WHERE list_id=?2 AND parent_id IS ?1),updated_at={NOW} WHERE id=?3"), params![parent_id,list_id,id])?;
    conn.execute("WITH RECURSIVE tree(id) AS (SELECT ?1 UNION ALL SELECT t.id FROM tasks t JOIN tree p ON t.parent_id=p.id) UPDATE tasks SET list_id=?2 WHERE id IN (SELECT id FROM tree)", params![id,list_id])?;
    let column = if parent_id.is_none() && completed { "completed_position" } else { "position" };
    let mut ordered = ids(conn, &format!("SELECT id FROM tasks WHERE list_id=?1 AND parent_id IS ?2 AND id<>?3 ORDER BY {column},id"), params![list_id,parent_id,id])?;
    let index = before_id.and_then(|b| ordered.iter().position(|v| v==b)).unwrap_or(ordered.len());
    ordered.insert(index, id.to_owned());
    positions(conn, "tasks", column, &ordered, None)?;
    normalize_tasks(conn, &old)?;
    if old != list_id { normalize_tasks(conn, list_id)?; }
    Ok(())
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
        let changes = match mutation {
            Mutation::Batch { changes } => changes,
            other => vec![other],
        };
        let tx = self.conn.transaction()?;
        for mutation in changes {
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
                place_task(&tx, &id, &list_id, None, None)?;
            }
            Mutation::PlaceTask { id, list_id, parent_id, before_id } => {
                place_task(&tx, &id, &list_id, parent_id.as_deref(), before_id.as_deref())?;
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
                let current=ids(&tx,&format!("SELECT id FROM tasks WHERE list_id=?1 AND parent_id IS NULL AND is_completed=?2 ORDER BY {column},id"),params![list_id,completed])?;
                same_members(&current, &requested)?;
                // Completed tasks retain their saved active slots. Only active slots exchange owners.
                let slots:Vec<i64>=tx.prepare(&format!("SELECT {column} FROM tasks WHERE list_id=?1 AND parent_id IS NULL AND is_completed=?2 ORDER BY {column},id"))?.query_map(params![list_id,completed],|r|r.get(0))?.collect::<std::result::Result<_,_>>()?;
                positions(&tx, "tasks", column, &requested, Some(&slots))?;
                normalize_tasks(&tx, &list_id)?;
            }
            Mutation::CreateStep {
                id,
                task_id,
                title: value,
            } => {
                valid_id(&id)?;
                tx.execute("INSERT INTO tasks(id,parent_id,list_id,title,position) VALUES(?1,?2,(SELECT list_id FROM tasks WHERE id=?2),?3,(SELECT COUNT(*) FROM tasks WHERE parent_id=?2))",params![id,task_id,title(&value)?])?;
            }
            Mutation::UpdateStep {
                id,
                title: value,
                completed,
            } => {
                let value = value.map(|v| title(&v)).transpose()?;
                changed(tx.execute(&format!("UPDATE tasks SET title=COALESCE(?1,title),is_completed=COALESCE(?2,is_completed),updated_at={NOW} WHERE id=?3 AND parent_id IS NOT NULL"),params![value,completed,id])?)?;
            }
            Mutation::DeleteStep { id } => {
                let task_id: String =
                    tx.query_row("SELECT task_id FROM steps WHERE id=?1", [&id], |r| r.get(0))?;
                changed(tx.execute("DELETE FROM tasks WHERE id=?1 AND parent_id IS NOT NULL", [id])?)?;
                let all = ids(
                    &tx,
                    "SELECT id FROM steps WHERE task_id=?1 ORDER BY position,id",
                    [task_id],
                )?;
                positions(&tx, "tasks", "position", &all, None)?;
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
                positions(&tx, "tasks", "position", &requested, None)?;
            }
            Mutation::DeleteAttachment { id } => {
                changed(tx.execute("DELETE FROM attachments WHERE id=?1", [id])?)?;
            }
            Mutation::Batch { .. } | Mutation::DuplicateTask { .. } => {
                return Err(Error::Invalid("This action cannot be included in a task batch.".into()));
            }
          }
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
        let mut mapping = std::collections::HashMap::new();
        mapping.insert(id.to_owned(), new_id.to_owned());
        let mut branch = vec![task];
        let mut i = 0;
        while i < branch.len() {
            let parent_id = branch[i].id.clone();
            for child in snapshot.tasks.iter().filter(|t| t.parent_id.as_deref() == Some(parent_id.as_str())) {
                mapping.insert(child.id.clone(), uuid::Uuid::new_v4().to_string());
                branch.push(child);
            }
            i += 1;
        }
        let mut copies = Vec::new();
        let result = (|| -> Result<()> {
            for attachment in snapshot.attachments.iter().filter(|a| mapping.contains_key(&a.task_id)) {
                let bytes = self.read_image(&attachment.stored_path)?;
                let (_, ext) = files::validate_image(&bytes)?;
                let copy_id = uuid::Uuid::new_v4().to_string();
                let name = format!("{copy_id}.{ext}");
                files::write_new(&self.image_dir.join(&name), &bytes)?;
                copies.push((copy_id, name, attachment));
            }
            let tx = self.conn.transaction()?;
            for original in &branch {
                let parent = if original.id == id { original.parent_id.clone() } else { original.parent_id.as_ref().and_then(|p| mapping.get(p).cloned()) };
                let position: i64 = if original.id == id { tx.query_row("SELECT COUNT(*) FROM tasks WHERE list_id=?1 AND parent_id IS ?2", params![task.list_id,parent], |r|r.get(0))? } else { original.position };
                tx.execute("INSERT INTO tasks(id,list_id,parent_id,title,notes,is_important,is_completed,position,completed_position,completed_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",params![mapping[&original.id],original.list_id,parent,original.title,original.notes,original.is_important,original.id!=id && original.is_completed,position,original.completed_position,if original.id==id {None} else {original.completed_at.as_deref()}])?;
            }
            for (copy_id, name, original) in &copies {
                tx.execute("INSERT INTO attachments(id,task_id,file_name,stored_path,mime_type,file_size) VALUES(?1,?2,?3,?4,?5,?6)",params![copy_id,mapping[&original.task_id],original.file_name,name,original.mime_type,original.file_size])?;
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
