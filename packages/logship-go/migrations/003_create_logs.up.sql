-- Create logs table
CREATE TABLE IF NOT EXISTS logs (
    id BIGSERIAL PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_logs_project_created ON logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level) WHERE level IN ('error', 'critical');
CREATE INDEX IF NOT EXISTS idx_logs_message_search ON logs USING gin(to_tsvector('english', message));
CREATE INDEX IF NOT EXISTS idx_logs_metadata ON logs USING gin(metadata);
