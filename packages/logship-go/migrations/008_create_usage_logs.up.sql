-- Create usage_logs table for tracking monthly log ingestion per project
CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
    month DATE NOT NULL, -- First day of the month (e.g., 2026-01-01)
    log_count BIGINT NOT NULL DEFAULT 0,
    bytes_ingested BIGINT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint on project + month for upsert operations
    CONSTRAINT unique_project_month UNIQUE (project_id, month)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_project ON usage_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_month ON usage_logs(month);
CREATE INDEX IF NOT EXISTS idx_usage_logs_project_month ON usage_logs(project_id, month);

-- Create a view for aggregating usage per user (across all their projects)
CREATE OR REPLACE VIEW user_monthly_usage AS
SELECT 
    p.owner_id AS user_id,
    ul.month,
    SUM(ul.log_count) AS total_log_count,
    SUM(ul.bytes_ingested) AS total_bytes_ingested,
    COUNT(DISTINCT ul.project_id) AS active_projects
FROM usage_logs ul
JOIN projects p ON ul.project_id = p.id
GROUP BY p.owner_id, ul.month;

-- Create function to get current month's usage for a user
CREATE OR REPLACE FUNCTION get_user_current_usage(p_user_id INT)
RETURNS TABLE (
    total_log_count BIGINT,
    total_bytes_ingested BIGINT,
    active_projects BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(ul.log_count), 0) AS total_log_count,
        COALESCE(SUM(ul.bytes_ingested), 0) AS total_bytes_ingested,
        COUNT(DISTINCT ul.project_id) AS active_projects
    FROM usage_logs ul
    JOIN projects p ON ul.project_id = p.id
    WHERE p.owner_id = p_user_id
    AND ul.month = DATE_TRUNC('month', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql;
