-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_create_default_subscription ON users;

-- Drop trigger function
DROP FUNCTION IF EXISTS create_default_subscription();

-- Drop subscriptions table
DROP TABLE IF EXISTS subscriptions;

-- Drop enum types
DROP TYPE IF EXISTS subscription_status;
DROP TYPE IF EXISTS subscription_tier;
