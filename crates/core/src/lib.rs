pub mod files;
pub mod model;
mod mutations;
use model::*;
use rusqlite::{params, Connection};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::Duration,
};
pub type Result<T> = std::result::Result<T, Error>;
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Invalid(String),
    #[error("Database operation failed: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("File operation failed: {0}")]
    Io(#[from] std::io::Error),
}
pub struct Database {
    pub(crate) conn: Connection,
    pub(crate) image_dir: PathBuf,
}
impl Database {
    pub fn open(directory: &Path) -> Result<Self> {
        fs::create_dir_all(directory)?;
        let image_dir = directory.join("attachments");
        fs::create_dir_all(&image_dir)?;
        let mut conn = Connection::open(directory.join("clearlist.db"))?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.execute_batch(
            "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
        )?;
        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
        if version > 2 {
            return Err(Error::Invalid(
                "Your data needs a newer version of Clearlist.".into(),
            ));
        }
        if version == 0 {
            let tx = conn.transaction()?;
            tx.execute_batch(include_str!("../migrations/001_initial.sql"))?;
            tx.execute(
                "INSERT INTO lists(id,name,position,is_default) VALUES(?1,'Tasks',0,1)",
                [uuid::Uuid::new_v4().to_string()],
            )?;
            tx.pragma_update(None, "user_version", 1)?;
            tx.commit()?;
        }
        if version < 2 {
            let tx = conn.transaction()?;
            tx.execute_batch(include_str!("../migrations/002_task_tree.sql"))?;
            tx.pragma_update(None, "user_version", 2)?;
            tx.commit()?;
        }
        Ok(Self { conn, image_dir })
    }
    pub fn snapshot(&self) -> Result<Snapshot> {
        let tx = self.conn.unchecked_transaction()?;
        let lists=tx.prepare("SELECT id,name,position,is_default,created_at,updated_at FROM lists ORDER BY position,id")?.query_map([],|r|Ok(List{id:r.get(0)?,name:r.get(1)?,position:r.get(2)?,is_default:r.get(3)?,created_at:r.get(4)?,updated_at:r.get(5)?}))?.collect::<std::result::Result<Vec<_>,_>>()?;
        let tasks=tx.prepare("SELECT id,list_id,title,notes,is_completed,is_important,position,completed_position,created_at,updated_at,completed_at,parent_id FROM tasks ORDER BY position,id")?.query_map([],|r|Ok(Task{id:r.get(0)?,list_id:r.get(1)?,title:r.get(2)?,notes:r.get(3)?,is_completed:r.get(4)?,is_important:r.get(5)?,position:r.get(6)?,completed_position:r.get(7)?,created_at:r.get(8)?,updated_at:r.get(9)?,completed_at:r.get(10)?,parent_id:r.get(11)?}))?.collect::<std::result::Result<Vec<_>,_>>()?;
        let steps=tx.prepare("SELECT id,task_id,title,is_completed,position,created_at,updated_at FROM steps ORDER BY position,id")?.query_map([],|r|Ok(Step{id:r.get(0)?,task_id:r.get(1)?,title:r.get(2)?,is_completed:r.get(3)?,position:r.get(4)?,created_at:r.get(5)?,updated_at:r.get(6)?}))?.collect::<std::result::Result<Vec<_>,_>>()?;
        let attachments=tx.prepare("SELECT id,task_id,file_name,stored_path,mime_type,file_size,created_at FROM attachments ORDER BY created_at,id")?.query_map([],|r|Ok(Attachment{id:r.get(0)?,task_id:r.get(1)?,file_name:r.get(2)?,stored_path:r.get(3)?,mime_type:r.get(4)?,file_size:r.get(5)?,created_at:r.get(6)?}))?.collect::<std::result::Result<Vec<_>,_>>()?;
        tx.commit()?;
        Ok(Snapshot {
            lists,
            tasks,
            steps,
            attachments,
            warning: None,
        })
    }
    pub fn snapshot_with_cleanup(&self) -> Result<Snapshot> {
        let mut snapshot = self.snapshot()?;
        if let Err(error) = self.cleanup_orphans() {
            eprintln!("Attachment cleanup: {error}");
            snapshot.warning=Some("Your change is saved, but an unused image could not be removed. Cleanup will retry on the next change or launch.".into());
        }
        Ok(snapshot)
    }
    pub fn cleanup_orphans(&self) -> Result<()> {
        let paths: HashSet<String> = self
            .conn
            .prepare("SELECT stored_path FROM attachments")?
            .query_map([], |r| r.get(0))?
            .collect::<std::result::Result<_, _>>()?;
        for entry in fs::read_dir(&self.image_dir)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if files::owned_name(&name) && !paths.contains(&name) && entry.file_type()?.is_file() {
                fs::remove_file(entry.path())?;
            }
        }
        Ok(())
    }
    pub fn add_attachment(&mut self, task_id: &str, bytes: &[u8]) -> Result<Snapshot> {
        let (mime, ext) = files::validate_image(bytes)?;
        let exists: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM tasks WHERE id=?1)",
            [task_id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(Error::Invalid("This task no longer exists.".into()));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let stored_path = format!("{id}.{ext}");
        let path = self.image_dir.join(&stored_path);
        files::write_new(&path, bytes)?;
        let result = (|| -> Result<()> {
            let tx = self.conn.transaction()?;
            tx.execute("INSERT INTO attachments(id,task_id,file_name,stored_path,mime_type,file_size) VALUES(?1,?2,?3,?4,?5,?6)",params![id,task_id,format!("Pasted image.{ext}"),stored_path,mime,bytes.len() as i64])?;
            tx.commit()?;
            Ok(())
        })();
        if let Err(error) = result {
            let _ = fs::remove_file(path);
            return Err(error);
        }
        self.snapshot_with_cleanup()
    }
    pub fn read_attachment(&self, id: &str) -> Result<Vec<u8>> {
        let path: String = self.conn.query_row(
            "SELECT stored_path FROM attachments WHERE id=?1",
            [id],
            |r| r.get(0),
        )?;
        self.read_image(&path)
    }
    pub(crate) fn read_image(&self, name: &str) -> Result<Vec<u8>> {
        if !files::owned_name(name) {
            return Err(Error::Invalid("The image path is invalid.".into()));
        }
        let path = self.image_dir.join(name);
        let meta = fs::symlink_metadata(&path)?;
        if !meta.is_file() || meta.len() > files::MAX_IMAGE_BYTES as u64 {
            return Err(Error::Invalid(
                "The image file is unavailable or too large.".into(),
            ));
        }
        Ok(fs::read(path)?)
    }
}
pub(crate) fn title(value: &str) -> Result<String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 500 {
        return Err(Error::Invalid(
            "Enter a title between 1 and 500 characters.".into(),
        ));
    }
    Ok(value.to_owned())
}
pub(crate) fn valid_id(value: &str) -> Result<()> {
    uuid::Uuid::parse_str(value)
        .map_err(|_| Error::Invalid("The item identifier is invalid.".into()))?;
    Ok(())
}
