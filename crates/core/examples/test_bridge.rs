//! Test-only JSON-lines adapter for exercising the real repository without a desktop WebView.
//! This example is not linked into or launched by the application.
use clearlist_core::{model::Mutation, Database};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    io::{self, BufRead, Write},
    path::Path,
};

#[derive(Deserialize)]
#[serde(tag = "command")]
enum Request {
    #[serde(rename = "snapshot")]
    Snapshot,
    #[serde(rename = "mutate")]
    Mutate { mutation: Mutation },
    #[serde(rename = "add_attachment")]
    Add {
        #[serde(rename = "taskId")]
        task_id: String,
        bytes: Vec<u8>,
    },
    #[serde(rename = "read_attachment")]
    Read { id: String },
}
fn reply(db: &mut Database, line: &str) -> Result<Value, Box<dyn std::error::Error>> {
    Ok(match serde_json::from_str::<Request>(line)? {
        Request::Snapshot => serde_json::to_value(db.snapshot_with_cleanup()?)?,
        Request::Mutate { mutation } => serde_json::to_value(db.apply(mutation)?)?,
        Request::Add { task_id, bytes } => {
            serde_json::to_value(db.add_attachment(&task_id, &bytes)?)?
        }
        Request::Read { id } => json!(db.read_attachment(&id)?),
    })
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let directory = std::env::args()
        .nth(1)
        .ok_or("Provide an isolated test data directory")?;
    let mut db = Database::open(Path::new(&directory))?;
    for line in io::stdin().lock().lines() {
        let response = match reply(&mut db, &line?) {
            Ok(value) => json!({"ok":value}),
            Err(error) => json!({"error":error.to_string()}),
        };
        println!("{response}");
        io::stdout().flush()?;
    }
    Ok(())
}
