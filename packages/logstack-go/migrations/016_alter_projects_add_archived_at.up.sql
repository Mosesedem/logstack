ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON projects(archived_at);
