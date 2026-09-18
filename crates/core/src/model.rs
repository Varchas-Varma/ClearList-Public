use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct List {
    pub id: String,
    pub name: String,
    pub position: i64,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub list_id: String,
    pub title: String,
    pub notes: String,
    pub is_completed: bool,
    pub is_important: bool,
    pub position: i64,
    pub completed_position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    pub id: String,
    pub task_id: String,
    pub title: String,
    pub is_completed: bool,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub task_id: String,
    pub file_name: String,
    pub stored_path: String,
    pub mime_type: String,
    pub file_size: i64,
    pub created_at: String,
}
#[derive(Clone, Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub lists: Vec<List>,
    pub tasks: Vec<Task>,
    pub steps: Vec<Step>,
    pub attachments: Vec<Attachment>,
    pub warning: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Mutation {
    CreateList {
        id: String,
        name: String,
    },
    RenameList {
        id: String,
        name: String,
    },
    DeleteList {
        id: String,
    },
    ReorderLists {
        ids: Vec<String>,
    },
    CreateTask {
        id: String,
        list_id: String,
        title: String,
    },
    UpdateTask {
        id: String,
        title: Option<String>,
        notes: Option<String>,
        important: Option<bool>,
    },
    CompleteTask {
        id: String,
        completed: bool,
    },
    DeleteTask {
        id: String,
    },
    DuplicateTask {
        id: String,
        new_id: String,
    },
    MoveTask {
        id: String,
        list_id: String,
    },
    ReorderTasks {
        list_id: String,
        completed: bool,
        ids: Vec<String>,
    },
    CreateStep {
        id: String,
        task_id: String,
        title: String,
    },
    UpdateStep {
        id: String,
        title: Option<String>,
        completed: Option<bool>,
    },
    DeleteStep {
        id: String,
    },
    ReorderSteps {
        task_id: String,
        ids: Vec<String>,
    },
    DeleteAttachment {
        id: String,
    },
}
