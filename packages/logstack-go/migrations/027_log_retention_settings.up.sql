ALTER TABLE pricing_plans ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 7;
UPDATE pricing_plans SET retention_days = 7 WHERE tier = 'free';
UPDATE pricing_plans SET retention_days = 30 WHERE tier = 'starter';
UPDATE pricing_plans SET retention_days = 90 WHERE tier = 'pro';
UPDATE pricing_plans SET retention_days = 365 WHERE tier = 'enterprise';

CREATE TABLE IF NOT EXISTS system_settings (
    key        varchar(64) PRIMARY KEY,
    value      text        NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO system_settings (key, value)
VALUES ('log_retention.enabled', 'true')
ON CONFLICT (key) DO NOTHING;
