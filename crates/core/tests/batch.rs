use clearlist_core::{model::Mutation, Database};
use tempfile::TempDir;
fn id() -> String { uuid::Uuid::new_v4().to_string() }
fn task(db: &mut Database, list: &str, title: &str) -> String {
    let id = id();
    db.apply(Mutation::CreateTask { id: id.clone(), list_id: list.into(), title: title.into() }).unwrap();
    id
}
#[test]
fn batch_rolls_back_earlier_changes_when_a_later_move_is_invalid() {
    let dir = TempDir::new().unwrap();
    let mut db = Database::open(dir.path()).unwrap();
    let list = db.snapshot().unwrap().lists[0].id.clone();
    let a = task(&mut db, &list, "A");
    let b = task(&mut db, &list, "B");
    let before = serde_json::to_value(db.snapshot().unwrap()).unwrap();
    assert!(db.apply(Mutation::Batch { changes: vec![
        Mutation::CompleteTask { id: a.clone(), completed: true },
        Mutation::PlaceTask { id: b.clone(), list_id: list, parent_id: Some(b), before_id: None },
    ] }).is_err());
    assert_eq!(serde_json::to_value(db.snapshot().unwrap()).unwrap(), before);
}
#[test]
fn batch_preserves_rescued_descendant_notes_and_images_through_purge_and_reopen() {
    let dir = TempDir::new().unwrap();
    let mut db = Database::open(dir.path()).unwrap();
    let list = db.snapshot().unwrap().lists[0].id.clone();
    let parent = task(&mut db, &list, "Completed parent");
    let child = id();
    db.apply(Mutation::CreateStep { id: child.clone(), task_id: parent.clone(), title: "Keep child".into() }).unwrap();
    db.apply(Mutation::Batch { changes: vec![
        Mutation::CompleteTask { id: parent.clone(), completed: true },
        Mutation::UpdateTask { id: child.clone(), title: None, notes: Some("Keep this note".into()), important: None },
    ] }).unwrap();
    let mut bytes = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(2,2).write_to(&mut bytes, image::ImageFormat::Png).unwrap();
    let image = bytes.into_inner();
    let attachment = db.add_attachment(&child, &image).unwrap().attachments[0].id.clone();
    db.apply(Mutation::Batch { changes: vec![
        Mutation::PlaceTask { id: child.clone(), list_id: list, parent_id: None, before_id: None },
        Mutation::DeleteTask { id: parent },
    ] }).unwrap();
    drop(db);
    let db = Database::open(dir.path()).unwrap();
    let data = db.snapshot().unwrap();
    assert_eq!(data.tasks.len(), 1);
    assert_eq!(data.tasks[0].id, child);
    assert_eq!(data.tasks[0].notes, "Keep this note");
    assert!(data.tasks[0].parent_id.is_none());
    assert!(!data.tasks[0].is_completed);
    assert_eq!(db.read_attachment(&attachment).unwrap(), image);
}
