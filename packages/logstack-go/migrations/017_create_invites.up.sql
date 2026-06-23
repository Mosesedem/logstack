-- Create invites table
CREATE TABLE IF NOT EXISTS invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email           varchar(255) NOT NULL,
    role            varchar(50)  NOT NULL,
    token           varchar(255) UNIQUE NOT NULL,
    status          varchar(20)  NOT NULL DEFAULT 'pending',
    expires_at      timestamptz  NOT NULL,
    created_at      timestamptz  NOT NULL DEFAULT NOW()
);

-- Add indexes for fast token lookups and org-scoped queries
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_org_id ON invites(organization_id);
