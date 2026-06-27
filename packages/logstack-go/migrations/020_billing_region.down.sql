DROP INDEX IF EXISTS idx_subscriptions_polar_subscription;
DROP INDEX IF EXISTS idx_subscriptions_billing_provider;

ALTER TABLE subscriptions DROP COLUMN IF EXISTS polar_customer_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS polar_subscription_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS billing_provider;

ALTER TABLE users DROP COLUMN IF EXISTS country;