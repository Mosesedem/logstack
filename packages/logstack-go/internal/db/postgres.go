package db

import (
	"context"
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// PostgresConfig holds database configuration
type PostgresConfig struct {
	DSN            string
	MaxIdleConns   int
	MaxOpenConns   int
	ConnMaxLife    time.Duration
	EnableLogging  bool
	SlowThreshold  time.Duration
}

// DefaultPostgresConfig returns sensible defaults
func DefaultPostgresConfig(dsn string) PostgresConfig {
	return PostgresConfig{
		DSN:           dsn,
		MaxIdleConns:  10,
		MaxOpenConns:  100,
		ConnMaxLife:   30 * time.Minute,
		EnableLogging: true,
		SlowThreshold: 200 * time.Millisecond,
	}
}

func NewPostgres(dsn string) (*gorm.DB, error) {
	return NewPostgresWithConfig(DefaultPostgresConfig(dsn))
}

func NewPostgresWithConfig(cfg PostgresConfig) (*gorm.DB, error) {
	logLevel := logger.Silent
	if cfg.EnableLogging {
		logLevel = logger.Warn
	}

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		// Disable default transaction for better performance
		SkipDefaultTransaction: true,
		// Disable prepared statement cache to avoid issues with Neon pooler and schema changes
		// This fixes "cached plan must not change result type" errors
		PrepareStmt: false,
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
	}

	// Connection pool settings
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(cfg.ConnMaxLife)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}

// HealthCheck verifies database connectivity
func HealthCheck(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return sqlDB.PingContext(ctx)
}

// GetDBStats returns database connection pool statistics
func GetDBStats(db *gorm.DB) (map[string]interface{}, error) {
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	stats := sqlDB.Stats()
	return map[string]interface{}{
		"maxOpenConnections": stats.MaxOpenConnections,
		"openConnections":    stats.OpenConnections,
		"inUse":              stats.InUse,
		"idle":               stats.Idle,
		"waitCount":          stats.WaitCount,
		"waitDuration":       stats.WaitDuration.String(),
		"maxIdleClosed":      stats.MaxIdleClosed,
		"maxLifetimeClosed":  stats.MaxLifetimeClosed,
	}, nil
}
