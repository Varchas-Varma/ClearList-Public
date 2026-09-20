ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX task_parent_order ON tasks(parent_id, position);

-- Keep existing identities, titles, completion state, order, and timestamps.
INSERT INTO tasks(id,list_id,parent_id,title,is_completed,position,completed_position,created_at,updated_at,completed_at)
SELECT s.id,t.list_id,s.task_id,s.title,s.is_completed,s.position,s.position,s.created_at,s.updated_at,
       CASE WHEN s.is_completed=1 THEN s.updated_at ELSE NULL END
FROM steps s JOIN tasks t ON t.id=s.task_id;
DROP TABLE steps;

-- Compatibility projection for the original step commands and snapshots.
CREATE VIEW steps AS
SELECT id,parent_id AS task_id,title,is_completed,position,created_at,updated_at
FROM tasks WHERE parent_id IS NOT NULL;
