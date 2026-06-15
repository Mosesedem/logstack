package db

import (
	"fmt"

	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

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
	// Plain CREATE TYPE (Neon/serverless PG rejects CREATE TYPE inside DO blocks).
	if err := db.Exec(fmt.Sprintf("CREATE TYPE %s AS ENUM (%s)", name, values)).Error; err != nil {
		return fmt.Errorf("create enum %s: %w", name, err)
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

	// Run AutoMigrate for all tables
	return db.AutoMigrate(
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
	)
}
