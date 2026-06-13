ALTER TABLE projects
ADD COLUMN environment VARCHAR(20) NOT NULL DEFAULT 'production';

-- Backfill: set development projects if a naming convention or tag exists (none by default)
