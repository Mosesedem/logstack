-- User country for billing region routing (NG → Paystack/NGN, else → Polar/USD)
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);

-- Subscription billing provider tracking
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(20) DEFAULT 'none';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS polar_subscription_id VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS polar_customer_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_provider ON subscriptions(billing_provider);
CREATE INDEX IF NOT EXISTS idx_subscriptions_polar_subscription ON subscriptions(polar_subscription_id);