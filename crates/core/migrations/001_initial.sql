CREATE TABLE lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  position INTEGER NOT NULL CHECK(position >= 0),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX one_default_list ON lists(is_default) WHERE is_default = 1;
CREATE TRIGGER protect_default_delete BEFORE DELETE ON lists WHEN OLD.is_default = 1
BEGIN SELECT RAISE(ABORT, 'The default list cannot be deleted.'); END;
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  notes TEXT NOT NULL DEFAULT '',
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0, 1)),
  is_important INTEGER NOT NULL DEFAULT 0 CHECK(is_important IN (0, 1)),
  position INTEGER NOT NULL CHECK(position >= 0),
  completed_position INTEGER NOT NULL DEFAULT 0 CHECK(completed_position >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at TEXT
);
CREATE INDEX task_list_order ON tasks(list_id, position);
CREATE INDEX completed_order ON tasks(list_id, is_completed, completed_position);
CREATE TABLE steps (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0),
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0, 1)),
  position INTEGER NOT NULL CHECK(position >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX step_task_order ON steps(task_id, position);
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK(file_size > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX attachment_task ON attachments(task_id);
