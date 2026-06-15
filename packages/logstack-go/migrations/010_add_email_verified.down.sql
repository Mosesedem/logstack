-- Remove email verification fields from users table
ALTER TABLE users 
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS verification_token,
DROP COLUMN IF EXISTS verification_sent_at;

-- Drop verification rate limits table
DROP TABLE IF EXISTS verification_rate_limits;

-- Drop index
DROP INDEX IF EXISTS idx_users_verification_token;
