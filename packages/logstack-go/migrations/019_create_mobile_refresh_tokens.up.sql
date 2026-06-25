CREATE TABLE mobile_refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       varchar(512) UNIQUE NOT NULL,
    device_info text,
    revoked     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mrt_user_id ON mobile_refresh_tokens(user_id);
CREATE INDEX idx_mrt_token   ON mobile_refresh_tokens(token);
