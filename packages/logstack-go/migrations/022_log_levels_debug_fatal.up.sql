ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_level_check;
ALTER TABLE logs ADD CONSTRAINT logs_level_check
  CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical', 'fatal'));