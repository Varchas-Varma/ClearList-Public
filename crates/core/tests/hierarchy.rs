use clearlist_core::{model::Mutation, Database};
use rusqlite::{params, Connection};
use std::io::Cursor;
use tempfile::TempDir;
fn id() -> String { uuid::Uuid::new_v4().to_string() }
fn task(db: &mut Database, list: &str, title: &str) -> String {
    let id=id();
    db.apply(Mutation::CreateTask{id:id.clone(),list_id:list.into(),title:title.into()}).unwrap();
    id
}
fn place(db: &mut Database, id: &str, list: &str, parent: Option<&str>, before: Option<&str>) {
    db.apply(Mutation::PlaceTask{id:id.into(),list_id:list.into(),parent_id:parent.map(str::to_owned),before_id:before.map(str::to_owned)}).unwrap();
}
#[test]
fn upgrades_010_steps_without_losing_data_and_reopens() {
    let dir=TempDir::new().unwrap();
    let conn=Connection::open(dir.path().join("clearlist.db")).unwrap();
    conn.execute_batch(include_str!("../migrations/001_initial.sql")).unwrap();
    let list=id(); let parent=id(); let step=id();
    conn.execute("INSERT INTO lists(id,name,position,is_default) VALUES(?1,'Tasks',0,1)",[&list]).unwrap();
    conn.execute("INSERT INTO tasks(id,list_id,title,notes,is_important,position) VALUES(?1,?2,'Parent','Keep these notes',1,0)",params![parent,list]).unwrap();
    conn.execute("INSERT INTO steps(id,task_id,title,is_completed,position) VALUES(?1,?2,'Old step',1,0)",params![step,parent]).unwrap();
    conn.pragma_update(None,"user_version",1).unwrap(); drop(conn);
    for _ in 0..2 {
        let db=Database::open(dir.path()).unwrap(); let s=db.snapshot().unwrap();
        assert_eq!(s.tasks.len(),2);
        let p=s.tasks.iter().find(|t|t.id==parent).unwrap();
        assert_eq!(p.notes,"Keep these notes"); assert!(p.is_important);
        let child=s.tasks.iter().find(|t|t.id==step).unwrap();
        assert_eq!(child.parent_id.as_deref(),Some(parent.as_str()));
        assert_eq!(child.title,"Old step"); assert!(child.is_completed);
    }
}
#[test]
fn promotes_and_nests_whole_branch_with_notes_images_and_order() {
    let dir=TempDir::new().unwrap(); let mut db=Database::open(dir.path()).unwrap();
    let list=db.snapshot().unwrap().lists[0].id.clone();
    let a=task(&mut db,&list,"A"); let b=task(&mut db,&list,"B"); let c=task(&mut db,&list,"C");
    let child=id(); db.apply(Mutation::CreateStep{id:child.clone(),task_id:a.clone(),title:"Child".into()}).unwrap();
    db.apply(Mutation::UpdateTask{id:a.clone(),title:None,notes:Some("Notes survive".into()),important:Some(true)}).unwrap();
    let mut bytes=Cursor::new(Vec::new()); image::DynamicImage::new_rgb8(2,2).write_to(&mut bytes,image::ImageFormat::Png).unwrap();
    let image=bytes.into_inner(); let attached=db.add_attachment(&child,&image).unwrap().attachments[0].id.clone();
    place(&mut db,&a,&list,Some(&b),None);
    assert_eq!(db.snapshot().unwrap().tasks.iter().find(|t|t.id==a).unwrap().parent_id.as_deref(),Some(b.as_str()));
    place(&mut db,&a,&list,None,Some(&c));
    drop(db); let db=Database::open(dir.path()).unwrap(); let s=db.snapshot().unwrap();
    let mut roots:Vec<_>=s.tasks.iter().filter(|t|t.parent_id.is_none()).collect(); roots.sort_by_key(|t|t.position);
    assert_eq!(roots.iter().map(|t|t.id.as_str()).collect::<Vec<_>>(),vec![b.as_str(),a.as_str(),c.as_str()]);
    let parent=s.tasks.iter().find(|t|t.id==a).unwrap(); assert_eq!(parent.notes,"Notes survive"); assert!(parent.is_important);
    assert_eq!(s.tasks.iter().find(|t|t.id==child).unwrap().parent_id.as_deref(),Some(a.as_str()));
    assert_eq!(db.read_attachment(&attached).unwrap(),image);
}
#[test]
fn rejects_cycles_and_invalid_gaps_atomically() {
    let dir=TempDir::new().unwrap(); let mut db=Database::open(dir.path()).unwrap();
    let list=db.snapshot().unwrap().lists[0].id.clone(); let a=task(&mut db,&list,"A"); let b=task(&mut db,&list,"B");
    place(&mut db,&b,&list,Some(&a),None);
    let before=serde_json::to_value(db.snapshot().unwrap()).unwrap();
    for (parent,before_id) in [(Some(b.clone()),None),(Some(a.clone()),None),(None,Some(id()))] {
        assert!(db.apply(Mutation::PlaceTask{id:a.clone(),list_id:list.clone(),parent_id:parent,before_id}).is_err());
        assert_eq!(serde_json::to_value(db.snapshot().unwrap()).unwrap(),before);
    }
}
#[test]
fn moves_duplicates_and_deletes_descendants_together() {
    let dir=TempDir::new().unwrap(); let mut db=Database::open(dir.path()).unwrap();
    let list=db.snapshot().unwrap().lists[0].id.clone(); let other=id();
    db.apply(Mutation::CreateList{id:other.clone(),name:"Other".into()}).unwrap();
    let a=task(&mut db,&list,"A"); let b=task(&mut db,&list,"B"); let c=task(&mut db,&list,"C");
    place(&mut db,&b,&list,Some(&a),None); place(&mut db,&c,&list,Some(&b),None);
    db.apply(Mutation::MoveTask{id:a.clone(),list_id:other.clone()}).unwrap();
    assert!(db.snapshot().unwrap().tasks.iter().all(|t|t.list_id==other));
    let copy=id(); db.apply(Mutation::DuplicateTask{id:a.clone(),new_id:copy.clone()}).unwrap();
    assert_eq!(db.snapshot().unwrap().tasks.len(),6);
    db.apply(Mutation::DeleteTask{id:a}).unwrap(); let s=db.snapshot().unwrap();
    assert_eq!(s.tasks.len(),3); assert!(!s.tasks.iter().any(|t| t.id==b || t.id==c));
    db.apply(Mutation::DeleteTask{id:copy}).unwrap(); assert!(db.snapshot().unwrap().tasks.is_empty());
}
