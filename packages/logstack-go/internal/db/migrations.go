package db

import (
	"fmt"
	"log/slog"

	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// sqlMigration represents a single numbered SQL migration.
type sqlMigration struct {
	Version string
	Up      string
}

// sqlMigrations holds every numbered migration in order.
// These run before AutoMigrate so data can be backfilled before NOT NULL constraints
// are enforced by the ORM.
var sqlMigrations = []sqlMigration{
	{
		Version: "015_alter_alert_rules_trigger_patterns",
		Up: `
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS trigger_patterns jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE alert_rules
  SET trigger_patterns = jsonb_build_array(trigger_pattern)
  WHERE trigger_patterns::text = '[]' AND trigger_pattern IS NOT NULL AND trigger_pattern <> '';
`,
	},
	{
		Version: "016_alter_projects_add_archived_at",
		Up: `
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_projects_archived_at ON projects(archived_at);
`,
	},
	{
		Version: "017_create_invites",
		Up: `
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
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_org_id ON invites(organization_id);
`,
	},
	{
		Version: "018_create_invoices",
		Up: `
CREATE TABLE IF NOT EXISTS invoices (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      integer      NOT NULL REFERENCES users(id),
    reference    varchar(255) UNIQUE NOT NULL,
    amount_cents integer      NOT NULL,
    currency     varchar(3)   NOT NULL,
    status       varchar(20)  NOT NULL DEFAULT 'pending',
    line_items   jsonb        NOT NULL DEFAULT '[]'::jsonb,
    paid_at      timestamptz,
    created_at   timestamptz  NOT NULL DEFAULT NOW(),
    updated_at   timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_reference ON invoices(reference);
`,
	},
	{
		Version: "019_alert_rules_add_channels_jsonb",
		Up: `
-- Add channels column (may not exist if instance was set up without migration 015 adding it)
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS channels jsonb DEFAULT '[]'::jsonb;

-- Backfill NULLs in both jsonb columns
UPDATE alert_rules SET trigger_patterns = '[]'::jsonb WHERE trigger_patterns IS NULL;
UPDATE alert_rules SET channels = '[]'::jsonb WHERE channels IS NULL;

-- Set NOT NULL + default on both columns
ALTER TABLE alert_rules
  ALTER COLUMN trigger_patterns SET DEFAULT '[]'::jsonb,
  ALTER COLUMN trigger_patterns SET NOT NULL,
  ALTER COLUMN channels SET DEFAULT '[]'::jsonb,
  ALTER COLUMN channels SET NOT NULL;
`,
	},
	{
		Version: "020_billing_region",
		Up: `
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_provider VARCHAR(20) DEFAULT 'none';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS polar_subscription_id VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS polar_customer_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_provider ON subscriptions(billing_provider);
CREATE INDEX IF NOT EXISTS idx_subscriptions_polar_subscription ON subscriptions(polar_subscription_id);
`,
	},
	{
		Version: "022_log_levels_debug_fatal",
		Up: `
ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_level_check;
ALTER TABLE logs ADD CONSTRAINT logs_level_check
  CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical', 'fatal'));
`,
	},
	{
		Version: "021_create_mobile_refresh_tokens",
		Up: `
CREATE TABLE IF NOT EXISTS mobile_refresh_tokens (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     integer      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       varchar(512) UNIQUE NOT NULL,
    device_info text,
    revoked     boolean      NOT NULL DEFAULT false,
    created_at  timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mrt_user_id ON mobile_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mrt_token   ON mobile_refresh_tokens(token);
`,
	},
}

func ensureEnumType(db *gorm.DB, name, values string) error {
	var exists bool
	if err := db.Raw(
		"SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = ?)",
		name,
	).Scan(&exists).Error; err != nil {
		return fmt.Errorf("check enum %s: %w", name, err)
	}
	if exists {
		return nil
	}
	if err := db.Exec(fmt.Sprintf("CREATE TYPE %s AS ENUM (%s)", name, values)).Error; err != nil {
		return fmt.Errorf("create enum %s: %w", name, err)
	}
	return nil
}

func ensureMigrationsTable(db *gorm.DB) error {
	return db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version     varchar(255) PRIMARY KEY,
			applied_at  timestamptz  NOT NULL DEFAULT NOW()
		)
	`).Error
}

func appliedVersions(db *gorm.DB) (map[string]bool, error) {
	var versions []string
	if err := db.Raw("SELECT version FROM schema_migrations").Scan(&versions).Error; err != nil {
		return nil, fmt.Errorf("query applied migrations: %w", err)
	}
	set := make(map[string]bool, len(versions))
	for _, v := range versions {
		set[v] = true
	}
	return set, nil
}

func runSQLMigrations(db *gorm.DB) error {
	if err := ensureMigrationsTable(db); err != nil {
		return fmt.Errorf("ensure migrations table: %w", err)
	}
	applied, err := appliedVersions(db)
	if err != nil {
		return err
	}
	for _, m := range sqlMigrations {
		if applied[m.Version] {
			continue
		}
		slog.Info("Applying SQL migration", "version", m.Version)
		if err := db.Exec(m.Up).Error; err != nil {
			return fmt.Errorf("apply migration %s: %w", m.Version, err)
		}
		if err := db.Exec(
			"INSERT INTO schema_migrations (version) VALUES (?)", m.Version,
		).Error; err != nil {
			return fmt.Errorf("record migration %s: %w", m.Version, err)
		}
	}
	return nil
}

func RunMigrations(db *gorm.DB) error {
	if err := ensureEnumType(db, "subscription_tier", "'free', 'starter', 'pro', 'enterprise'"); err != nil {
		return err
	}
	if err := ensureEnumType(db, "subscription_status", "'active', 'cancelled', 'past_due', 'trialing', 'paused'"); err != nil {
		return err
	}

	// SQL migrations run FIRST: they add columns and backfill data before AutoMigrate
	// tries to enforce NOT NULL constraints on those columns.
	if err := runSQLMigrations(db); err != nil {
		return err
	}

	// AutoMigrate creates missing tables/columns for all models.
	// We guard this with a version key so it only runs when the schema version changes,
	// not on every startup (which would hammer a remote DB with 100+ inspection queries).
	const autoMigrateVersion = "automigrate_v3"
	applied, err := appliedVersions(db)
	if err != nil {
		return err
	}
	if !applied[autoMigrateVersion] {
		slog.Info("Running AutoMigrate (first time or schema version changed)")
		if err := db.AutoMigrate(
			&models.User{},
			&models.Organization{},
			&models.OrganizationMember{},
			&models.AuditLog{},
			&models.Project{},
			&models.Log{},
			&models.AlertRule{},
			&models.PushToken{},
			&models.AlertHistory{},
			&models.Subscription{},
			&models.UsageLog{},
			&models.Invite{},
			&models.Invoice{},
			&models.MobileRefreshToken{},
		); err != nil {
			return err
		}
		if err := db.Exec(
			"INSERT INTO schema_migrations (version) VALUES (?) ON CONFLICT DO NOTHING",
			autoMigrateVersion,
		).Error; err != nil {
			return fmt.Errorf("record automigrate version: %w", err)
		}
		slog.Info("AutoMigrate completed")
	}

	return nil
}
