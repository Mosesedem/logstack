ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS session_id uuid;
CREATE INDEX IF NOT EXISTS idx_push_tokens_session_id ON push_tokens(session_id);
ALTER TABLE mobile_refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at timestamptz;
