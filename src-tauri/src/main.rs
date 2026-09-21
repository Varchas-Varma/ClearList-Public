#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use clearlist_core::{
    model::{Mutation, Snapshot},
    Database, Error,
};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{
    ipc::{InvokeBody, Request, Response},
    Manager, State,
};
struct Backend {
    directory: Result<PathBuf, String>,
    database: Option<Database>,
}
type Shared = Arc<Mutex<Backend>>;
fn public_error(error: Error) -> String {
    eprintln!("Clearlist: {error}");
    match error{Error::Invalid(message)=>message,Error::Io(_)=>"Could not access local data or an image. Check disk space and folder permissions, then retry.".into(),Error::Sql(_)=>"Could not save or read your data. Check disk space and retry.".into()}
}
async fn with_database<T: Send + 'static>(
    shared: Shared,
    operation: impl FnOnce(&mut Database) -> clearlist_core::Result<T> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut backend = shared
            .lock()
            .map_err(|_| "Please restart Clearlist.".to_owned())?;
        if backend.database.is_none() {
            let directory = backend.directory.as_ref().map_err(Clone::clone)?;
            backend.database = Some(Database::open(directory).map_err(public_error)?);
        }
        operation(
            backend
                .database
                .as_mut()
                .ok_or("Local data is unavailable.")?,
        )
        .map_err(public_error)
    })
    .await
    .map_err(|_| "The operation was interrupted. Please retry.".to_owned())?
}
#[tauri::command]
async fn snapshot(state: State<'_, Shared>) -> Result<Snapshot, String> {
    with_database(state.inner().clone(), |db| db.snapshot_with_cleanup()).await
}
#[tauri::command]
async fn mutate(state: State<'_, Shared>, mutation: Mutation) -> Result<Snapshot, String> {
    with_database(state.inner().clone(), move |db| db.apply(mutation)).await
}
#[tauri::command]
async fn add_attachment(
    state: State<'_, Shared>,
    request: Request<'_>,
) -> Result<Snapshot, String> {
    let task_id = request
        .headers()
        .get("x-task-id")
        .and_then(|h| h.to_str().ok())
        .ok_or("Select a task before pasting an image.")?
        .to_owned();
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) if bytes.len() <= clearlist_core::files::MAX_IMAGE_BYTES => {
            bytes.clone()
        }
        _ => return Err("Images must be at most 15 MiB.".into()),
    };
    with_database(state.inner().clone(), move |db| {
        db.add_attachment(&task_id, &bytes)
    })
    .await
}
#[tauri::command]
async fn read_attachment(state: State<'_, Shared>, id: String) -> Result<Response, String> {
    with_database(state.inner().clone(), move |db| db.read_attachment(&id))
        .await
        .map(Response::new)
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let directory = app
                .path()
                .app_local_data_dir()
                .map(|path| {
                    if cfg!(debug_assertions) {
                        path.join("development")
                    } else {
                        path
                    }
                })
                .map_err(|error| {
                    eprintln!("Data directory: {error}");
                    "The application data directory is unavailable.".to_owned()
                });
            #[cfg(debug_assertions)]
            eprintln!("Clearlist data directory: {directory:?}");
            app.manage(Arc::new(Mutex::new(Backend {
                directory,
                database: None,
            })));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            mutate,
            add_attachment,
            read_attachment
        ])
        .run(tauri::generate_context!())
        .expect("Clearlist could not start its desktop window");
}
