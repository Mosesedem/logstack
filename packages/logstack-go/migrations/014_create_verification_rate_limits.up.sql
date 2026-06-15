-- Migration 014: Create verification_rate_limits table
-- This table is used as a fallback when Redis is unavailable for rate limiting
-- email verification resend requests.

CREATE TABLE IF NOT EXISTS verification_rate_limits (
    id        BIGSERIAL    PRIMARY KEY,
    email     VARCHAR(255) NOT NULL,
    sent_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vrl_email_sent ON verification_rate_limits(email, sent_at);

-- Auto-clean entries older than 2 hours (belt-and-suspenders with Redis TTL)
-- This is handled by the application, but the index supports efficient cleanup.
