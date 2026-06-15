package db

import (
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

func RunMigrations(db *gorm.DB) error {
	// Create enum types if they don't exist
	// PostgreSQL enums need to be created before tables that use them
	err := db.Exec(`
		DO $$ BEGIN
			CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'pro', 'enterprise');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$;
	`).Error
	if err != nil {
		return err
	}

	err = db.Exec(`
		DO $$ BEGIN
			CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing', 'paused');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$;
	`).Error
	if err != nil {
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
