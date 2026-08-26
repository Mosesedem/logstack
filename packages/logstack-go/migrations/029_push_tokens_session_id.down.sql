DROP INDEX IF EXISTS idx_push_tokens_session_id;
ALTER TABLE push_tokens DROP COLUMN IF EXISTS session_id;
ALTER TABLE mobile_refresh_tokens DROP COLUMN IF EXISTS last_used_at;
