-- Create alert_rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    trigger_pattern VARCHAR(500) NOT NULL,
    trigger_level VARCHAR(10),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'push', 'webhook')),
    recipient TEXT NOT NULL,
    cooldown_minutes INT DEFAULT 15 CHECK (cooldown_minutes >= 0),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for project alert rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_project ON alert_rules(project_id, enabled);
