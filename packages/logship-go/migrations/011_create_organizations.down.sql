-- Undo Subscriptions migration
ALTER TABLE subscriptions DROP COLUMN IF EXISTS organization_id;

-- Undo Projects migration
ALTER TABLE projects DROP COLUMN IF EXISTS organization_id;

-- Drop tables
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organizations;
