-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization_members table
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Add temporary column to track mapping during migration
ALTER TABLE organizations ADD COLUMN created_by_user_id INT;

-- Insert organizations for each existing user
INSERT INTO organizations (name, slug, created_by_user_id, created_at, updated_at)
SELECT 
    COALESCE(NULLIF(name, ''), 'User ' || id) || '''s Organization', 
    'org-' || id || '-' || floor(random() * 1000)::text,
    id,
    NOW(), 
    NOW()
FROM users;

-- Populate members (Make every user an owner of their new org)
INSERT INTO organization_members (organization_id, user_id, role)
SELECT id, created_by_user_id, 'owner'
FROM organizations
WHERE created_by_user_id IS NOT NULL;

-- Migrate Projects
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);

UPDATE projects p
SET organization_id = o.id
FROM organizations o
WHERE p.owner_id = o.created_by_user_id;

-- Migrate Subscriptions
ALTER TABLE subscriptions ADD COLUMN organization_id UUID REFERENCES organizations(id);

UPDATE subscriptions s
SET organization_id = o.id
FROM organizations o
WHERE s.user_id = o.created_by_user_id;

-- Drop temporary column
ALTER TABLE organizations DROP COLUMN created_by_user_id;

-- Add indexes for performance
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_projects_org_id ON projects(organization_id);
