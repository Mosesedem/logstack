-- Create alert_history table for logging sent alerts
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    alert_rule_id INT REFERENCES alert_rules(id) ON DELETE CASCADE,
    log_id BIGINT REFERENCES logs(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT
);

-- Create index for history lookup
CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(alert_rule_id, sent_at DESC);
