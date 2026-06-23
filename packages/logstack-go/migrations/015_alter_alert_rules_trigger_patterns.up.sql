-- Add trigger_patterns jsonb column, keep trigger_pattern for backwards compat during migration
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS trigger_patterns jsonb NOT NULL DEFAULT '[]';

-- Migrate existing single pattern to array
UPDATE alert_rules
  SET trigger_patterns = jsonb_build_array(trigger_pattern)
  WHERE trigger_patterns = '[]' AND trigger_pattern IS NOT NULL AND trigger_pattern != '';
