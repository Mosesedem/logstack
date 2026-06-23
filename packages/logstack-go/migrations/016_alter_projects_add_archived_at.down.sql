DROP INDEX IF EXISTS idx_projects_archived_at;
ALTER TABLE projects DROP COLUMN IF EXISTS archived_at;
