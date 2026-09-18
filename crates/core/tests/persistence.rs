use clearlist_core::{
    files::{self, MAX_IMAGE_BYTES},
    model::Mutation,
    Database,
};
use std::{fs, io::Cursor};
use tempfile::TempDir;
fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn setup() -> (TempDir, Database, String) {
    let dir = TempDir::new().unwrap();
    let db = Database::open(dir.path()).unwrap();
    let list = db.snapshot().unwrap().lists[0].id.clone();
    (dir, db, list)
}
fn task(db: &mut Database, list: &str, title: &str) -> String {
    let id = id();
    db.apply(Mutation::CreateTask {
        id: id.clone(),
        list_id: list.into(),
        title: title.into(),
    })
    .unwrap();
    id
}
fn list(db: &mut Database, name: &str) -> String {
    let id = id();
    db.apply(Mutation::CreateList {
        id: id.clone(),
        name: name.into(),
    })
    .unwrap();
    id
}
fn png() -> Vec<u8> {
    let mut bytes = Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(3, 3)
        .write_to(&mut bytes, image::ImageFormat::Png)
        .unwrap();
    bytes.into_inner()
}
fn order(db: &Database, list: &str, completed: bool) -> Vec<String> {
    let mut tasks: Vec<_> = db
        .snapshot()
        .unwrap()
        .tasks
        .into_iter()
        .filter(|t| t.list_id == list && t.is_completed == completed)
        .collect();
    tasks.sort_by_key(|t| {
        if completed {
            t.completed_position
        } else {
            t.position
        }
    });
    tasks.into_iter().map(|t| t.id).collect()
}
#[test]
fn migrations_default_and_restart() {
    let (dir, mut db, default) = setup();
    assert!(db.snapshot().unwrap().lists[0].is_default);
    let a = task(&mut db, &default, "First");
    let b = task(&mut db, &default, "Second");
    db.apply(Mutation::ReorderTasks {
        list_id: default.clone(),
        completed: false,
        ids: vec![b.clone(), a.clone()],
    })
    .unwrap();
    drop(db);
    let reopened = Database::open(dir.path()).unwrap();
    assert_eq!(reopened.snapshot().unwrap().lists.len(), 1);
    assert_eq!(order(&reopened, &default, false), vec![b, a]);
}
#[test]
fn task_lifecycle_and_empty_validation() {
    let (_dir, mut db, default) = setup();
    let a = task(&mut db, &default, "  A  ");
    assert_eq!(db.snapshot().unwrap().tasks[0].title, "A");
    db.apply(Mutation::UpdateTask {
        id: a.clone(),
        title: Some("Renamed".into()),
        notes: Some("line 1\nline 2".into()),
        important: Some(true),
    })
    .unwrap();
    assert!(db
        .apply(Mutation::UpdateTask {
            id: a.clone(),
            title: Some(" \n ".into()),
            notes: None,
            important: None
        })
        .is_err());
    db.apply(Mutation::CompleteTask {
        id: a.clone(),
        completed: true,
    })
    .unwrap();
    let saved = db.snapshot().unwrap();
    assert_eq!(saved.tasks[0].title, "Renamed");
    assert_eq!(saved.tasks[0].notes, "line 1\nline 2");
    assert!(
        saved.tasks[0].is_important
            && saved.tasks[0].is_completed
            && saved.tasks[0].completed_at.is_some()
    );
    db.apply(Mutation::DeleteTask { id: a }).unwrap();
    assert!(db.snapshot().unwrap().tasks.is_empty());
}
#[test]
fn custom_lists_duplicate_names_reorder_and_delete() {
    let (_dir, mut db, default) = setup();
    let a = list(&mut db, "Study");
    let b = list(&mut db, "Study");
    assert!(db
        .apply(Mutation::CreateList {
            id: id(),
            name: " ".into()
        })
        .is_err());
    db.apply(Mutation::ReorderLists {
        ids: vec![b.clone(), a.clone()],
    })
    .unwrap();
    let saved = db.snapshot().unwrap();
    assert_eq!(
        saved.lists.iter().map(|l| l.position).collect::<Vec<_>>(),
        vec![0, 1, 2]
    );
    assert_eq!(saved.lists[1].id, b);
    db.apply(Mutation::RenameList {
        id: a.clone(),
        name: "Work".into(),
    })
    .unwrap();
    assert!(db.apply(Mutation::DeleteList { id: default }).is_err());
    db.apply(Mutation::DeleteList { id: b }).unwrap();
    assert_eq!(db.snapshot().unwrap().lists[1].id, a);
}
#[test]
fn completion_retains_active_slot_and_independent_completed_order() {
    let (_dir, mut db, default) = setup();
    let a = task(&mut db, &default, "same");
    let b = task(&mut db, &default, "same");
    let c = task(&mut db, &default, "C");
    db.apply(Mutation::CompleteTask {
        id: b.clone(),
        completed: true,
    })
    .unwrap();
    db.apply(Mutation::ReorderTasks {
        list_id: default.clone(),
        completed: false,
        ids: vec![c.clone(), a.clone()],
    })
    .unwrap();
    db.apply(Mutation::CompleteTask {
        id: b.clone(),
        completed: false,
    })
    .unwrap();
    assert_eq!(
        order(&db, &default, false),
        vec![c.clone(), b.clone(), a.clone()]
    );
    db.apply(Mutation::CompleteTask {
        id: a.clone(),
        completed: true,
    })
    .unwrap();
    db.apply(Mutation::CompleteTask {
        id: b.clone(),
        completed: true,
    })
    .unwrap();
    db.apply(Mutation::ReorderTasks {
        list_id: default.clone(),
        completed: true,
        ids: vec![b.clone(), a.clone()],
    })
    .unwrap();
    assert_eq!(order(&db, &default, true), vec![b, a]);
    assert_eq!(order(&db, &default, false), vec![c]);
}
#[test]
fn moving_and_repeated_reordering_keep_contiguous_positions() {
    let (_dir, mut db, default) = setup();
    let a = task(&mut db, &default, "A");
    let b = task(&mut db, &default, "B");
    let destination = list(&mut db, "Next");
    for i in 0..40 {
        let ids = if i % 2 == 0 {
            vec![b.clone(), a.clone()]
        } else {
            vec![a.clone(), b.clone()]
        };
        db.apply(Mutation::ReorderTasks {
            list_id: default.clone(),
            completed: false,
            ids,
        })
        .unwrap();
    }
    db.apply(Mutation::MoveTask {
        id: a.clone(),
        list_id: destination.clone(),
    })
    .unwrap();
    assert_eq!(order(&db, &destination, false), vec![a]);
    assert_eq!(order(&db, &default, false), vec![b]);
    assert!(db.snapshot().unwrap().tasks.iter().all(|t| t.position == 0));
}
#[test]
fn invalid_reorder_is_atomic_and_foreign_keys_hold() {
    let (_dir, mut db, default) = setup();
    let a = task(&mut db, &default, "A");
    let b = task(&mut db, &default, "B");
    assert!(db
        .apply(Mutation::ReorderTasks {
            list_id: default.clone(),
            completed: false,
            ids: vec![b.clone(), b.clone()]
        })
        .is_err());
    assert_eq!(order(&db, &default, false), vec![a.clone(), b]);
    assert!(db
        .apply(Mutation::MoveTask {
            id: a.clone(),
            list_id: id()
        })
        .is_err());
    assert_eq!(
        db.snapshot()
            .unwrap()
            .tasks
            .iter()
            .find(|t| t.id == a)
            .unwrap()
            .list_id,
        default
    );
}
#[test]
fn steps_reorder_update_and_cascade() {
    let (_dir, mut db, default) = setup();
    let parent = task(&mut db, &default, "Parent");
    let a = id();
    let b = id();
    for id in [&a, &b] {
        db.apply(Mutation::CreateStep {
            id: id.clone(),
            task_id: parent.clone(),
            title: "Step".into(),
        })
        .unwrap();
    }
    db.apply(Mutation::ReorderSteps {
        task_id: parent.clone(),
        ids: vec![b.clone(), a.clone()],
    })
    .unwrap();
    db.apply(Mutation::UpdateStep {
        id: b.clone(),
        title: Some("Renamed".into()),
        completed: Some(true),
    })
    .unwrap();
    let saved = db.snapshot().unwrap();
    assert_eq!(saved.steps[0].id, b);
    assert!(saved.steps[0].is_completed);
    db.apply(Mutation::DeleteStep { id: b }).unwrap();
    assert_eq!(db.snapshot().unwrap().steps[0].position, 0);
    assert!(db
        .apply(Mutation::CreateStep {
            id: id(),
            task_id: parent.clone(),
            title: " ".into()
        })
        .is_err());
    db.apply(Mutation::DeleteTask { id: parent }).unwrap();
    assert!(db.snapshot().unwrap().steps.is_empty());
}
#[test]
fn attachment_metadata_bytes_restart_and_delete() {
    let (dir, mut db, default) = setup();
    let parent = task(&mut db, &default, "Image");
    let image = png();
    let saved = db.add_attachment(&parent, &image).unwrap();
    let file = &saved.attachments[0];
    assert_eq!(file.mime_type, "image/png");
    assert_eq!(file.file_size, image.len() as i64);
    assert!(files::owned_name(&file.stored_path));
    let attachment_id = file.id.clone();
    let path = dir.path().join("attachments").join(&file.stored_path);
    assert_eq!(db.read_attachment(&attachment_id).unwrap(), image);
    drop(db);
    let mut db = Database::open(dir.path()).unwrap();
    assert_eq!(db.read_attachment(&attachment_id).unwrap(), image);
    db.apply(Mutation::DeleteAttachment { id: attachment_id })
        .unwrap();
    assert!(!path.exists());
    assert!(db.snapshot().unwrap().attachments.is_empty());
}
#[test]
fn failed_database_delete_does_not_remove_image() {
    let (dir, mut db, default) = setup();
    let parent = task(&mut db, &default, "Image");
    let saved = db.add_attachment(&parent, &png()).unwrap();
    let file = &saved.attachments[0];
    let connection = rusqlite::Connection::open(dir.path().join("clearlist.db")).unwrap();
    connection.execute_batch("CREATE TRIGGER fail_delete BEFORE DELETE ON tasks BEGIN SELECT RAISE(ABORT,'simulated disk error'); END;").unwrap();
    assert!(db.apply(Mutation::DeleteTask { id: parent }).is_err());
    assert_eq!(db.snapshot().unwrap().tasks.len(), 1);
    assert!(db.read_attachment(&file.id).is_ok());
}
#[test]
fn delete_list_cascades_and_orphan_cleanup_is_scoped() {
    let (dir, mut db, _) = setup();
    let custom = list(&mut db, "Disposable");
    let parent = task(&mut db, &custom, "Image");
    db.add_attachment(&parent, &png()).unwrap();
    let orphan = dir.path().join("attachments").join(format!("{}.png", id()));
    fs::write(&orphan, png()).unwrap();
    let unrelated = dir.path().join("attachments").join("user-file.png");
    fs::write(&unrelated, png()).unwrap();
    db.apply(Mutation::DeleteList { id: custom }).unwrap();
    assert!(!orphan.exists());
    assert!(unrelated.exists());
    assert!(db.snapshot().unwrap().attachments.is_empty());
    assert_eq!(
        fs::read_dir(dir.path().join("attachments"))
            .unwrap()
            .count(),
        1
    );
}
#[test]
fn duplication_copies_images_and_steps_without_shared_files() {
    let (_dir, mut db, default) = setup();
    let parent = task(&mut db, &default, "Original");
    db.apply(Mutation::CreateStep {
        id: id(),
        task_id: parent.clone(),
        title: "Step".into(),
    })
    .unwrap();
    db.add_attachment(&parent, &png()).unwrap();
    let copy = id();
    db.apply(Mutation::DuplicateTask {
        id: parent.clone(),
        new_id: copy.clone(),
    })
    .unwrap();
    let saved = db.snapshot().unwrap();
    assert_eq!(saved.steps.len(), 2);
    assert_eq!(saved.attachments.len(), 2);
    assert_ne!(
        saved.attachments[0].stored_path,
        saved.attachments[1].stored_path
    );
    db.apply(Mutation::DeleteTask { id: parent }).unwrap();
    let saved = db.snapshot().unwrap();
    assert_eq!(saved.tasks[0].id, copy);
    assert!(db.read_attachment(&saved.attachments[0].id).is_ok());
}
#[test]
fn missing_images_and_invalid_paths_do_not_touch_other_files() {
    let (dir, mut db, default) = setup();
    let parent = task(&mut db, &default, "Image");
    let saved = db.add_attachment(&parent, &png()).unwrap();
    let file = &saved.attachments[0];
    fs::remove_file(dir.path().join("attachments").join(&file.stored_path)).unwrap();
    assert!(db.read_attachment(&file.id).is_err());
    let outside = dir.path().join("outside.png");
    fs::write(&outside, png()).unwrap();
    let connection = rusqlite::Connection::open(dir.path().join("clearlist.db")).unwrap();
    connection
        .execute(
            "UPDATE attachments SET stored_path='../outside.png' WHERE id=?1",
            [&file.id],
        )
        .unwrap();
    assert!(db.read_attachment(&file.id).is_err());
    db.cleanup_orphans().unwrap();
    assert!(outside.exists());
}
#[test]
fn clipboard_formats_sizes_and_corrupt_data_are_validated() {
    assert_eq!(files::validate_image(&png()).unwrap(), ("image/png", "png"));
    for format in [image::ImageFormat::Jpeg, image::ImageFormat::WebP] {
        let mut bytes = Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(2, 2)
            .write_to(&mut bytes, format)
            .unwrap();
        assert!(files::validate_image(&bytes.into_inner()).is_ok());
    }
    assert!(files::validate_image(b"hello").is_err());
    assert!(files::validate_image(b"GIF89a").is_err());
    assert!(files::validate_image(&vec![0; MAX_IMAGE_BYTES + 1]).is_err());
    let bytes = png();
    assert!(files::validate_image(&bytes[..bytes.len() / 2]).is_err());
    assert!(!files::owned_name("../../not-ours.png"));
}
#[test]
fn unavailable_data_directory_returns_error() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("not-a-folder");
    fs::write(&path, b"file").unwrap();
    assert!(Database::open(&path).is_err());
}
#[test]
fn metadata_insert_failure_rolls_back_new_file() {
    let (dir, mut db, default) = setup();
    let parent = task(&mut db, &default, "Image");
    let conn = rusqlite::Connection::open(dir.path().join("clearlist.db")).unwrap();
    conn.execute_batch("CREATE TRIGGER fail_attachment BEFORE INSERT ON attachments BEGIN SELECT RAISE(ABORT,'simulated disk error'); END;").unwrap();
    assert!(db.add_attachment(&parent, &png()).is_err());
    assert!(db.snapshot().unwrap().attachments.is_empty());
    assert_eq!(
        fs::read_dir(dir.path().join("attachments"))
            .unwrap()
            .count(),
        0
    );
}
#[test]
fn camel_case_command_contract_matches_frontend() {
    let (_dir, mut db, default) = setup();
    let task_id = id();
    let json = serde_json::json!({"kind":"createTask","id":task_id,"listId":default,"title":"Contract test"});
    let mutation: Mutation = serde_json::from_value(json).unwrap();
    let data = serde_json::to_value(db.apply(mutation).unwrap()).unwrap();
    assert_eq!(data["tasks"][0]["listId"], default);
    assert_eq!(data["tasks"][0]["isCompleted"], false);
}
