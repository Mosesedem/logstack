package workers

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupRetentionDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	stmts := []string{
		`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL,
			password_hash TEXT NOT NULL DEFAULT 'x',
			name TEXT,
			role TEXT NOT NULL DEFAULT 'user'
		)`,
		`CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			owner_id INTEGER NOT NULL,
			api_key TEXT NOT NULL,
			environment TEXT NOT NULL DEFAULT 'production'
		)`,
		`CREATE TABLE subscriptions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			tier TEXT NOT NULL,
			status TEXT NOT NULL
		)`,
		`CREATE TABLE logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id TEXT NOT NULL,
			level TEXT NOT NULL,
			message TEXT NOT NULL,
			created_at DATETIME
		)`,
		`CREATE TABLE pricing_plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tier TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			log_limit INTEGER NOT NULL DEFAULT 0,
			retention_days INTEGER NOT NULL DEFAULT 7,
			features TEXT NOT NULL DEFAULT '[]',
			prices TEXT NOT NULL DEFAULT '{}',
			limits TEXT NOT NULL DEFAULT '{}',
			sort_order INTEGER NOT NULL DEFAULT 0,
			active INTEGER NOT NULL DEFAULT 1
		)`,
		`CREATE TABLE system_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at DATETIME
		)`,
		`CREATE TABLE alert_histories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			alert_rule_id INTEGER NOT NULL,
			log_id INTEGER,
			sent_at DATETIME,
			status TEXT NOT NULL,
			error_message TEXT
		)`,
	}
	for _, stmt := range stmts {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("schema: %v\n%s", err, stmt)
		}
	}
	return db
}

func seedRetentionFixture(t *testing.T, db *gorm.DB, retentionDays int, logAge time.Duration) (uuid.UUID, int64) {
	t.Helper()
	if err := db.Exec(
		`INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)`,
		"owner@example.com", "x", "Owner", "user",
	).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	var userID uint
	if err := db.Raw(`SELECT id FROM users WHERE email = ?`, "owner@example.com").Scan(&userID).Error; err != nil {
		t.Fatalf("user id: %v", err)
	}
	projectID := uuid.New()
	if err := db.Exec(
		`INSERT INTO projects (id, name, owner_id, api_key, environment) VALUES (?,?,?,?,?)`,
		projectID.String(), "prod", userID, "ls_test_"+projectID.String(), "production",
	).Error; err != nil {
		t.Fatalf("create project: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO subscriptions (user_id, tier, status) VALUES (?,?,?)`,
		userID, string(models.TierStarter), string(models.StatusActive),
	).Error; err != nil {
		t.Fatalf("create subscription: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO pricing_plans (tier, name, log_limit, retention_days, features, prices, limits, active)
		 VALUES (?,?,?,?,?,?,?,?)`,
		string(models.TierStarter), "Starter", 500000, retentionDays, "[]", "{}", "{}", 1,
	).Error; err != nil {
		t.Fatalf("create plan: %v", err)
	}

	oldAt := time.Now().UTC().Add(-logAge)
	freshAt := time.Now().UTC()
	if err := db.Exec(
		`INSERT INTO logs (project_id, level, message, created_at) VALUES (?,?,?,?)`,
		projectID.String(), "info", "old", oldAt,
	).Error; err != nil {
		t.Fatalf("create old log: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO logs (project_id, level, message, created_at) VALUES (?,?,?,?)`,
		projectID.String(), "info", "fresh", freshAt,
	).Error; err != nil {
		t.Fatalf("create fresh log: %v", err)
	}
	var keepID int64
	if err := db.Raw(`SELECT id FROM logs WHERE message = ?`, "fresh").Scan(&keepID).Error; err != nil {
		t.Fatalf("fresh id: %v", err)
	}
	return projectID, keepID
}

func TestLogRetentionDeletesExpiredLogs(t *testing.T) {
	db := setupRetentionDB(t)
	_, keepID := seedRetentionFixture(t, db, 7, 10*24*time.Hour)

	w := NewLogRetentionWorker(db)
	result := w.Run(context.Background(), "admin")
	if result.Error != "" {
		t.Fatalf("run error: %s", result.Error)
	}
	if result.Deleted != 1 {
		t.Fatalf("deleted=%d want 1", result.Deleted)
	}

	var remaining []models.Log
	if err := db.Find(&remaining).Error; err != nil {
		t.Fatalf("list logs: %v", err)
	}
	if len(remaining) != 1 {
		t.Fatalf("remaining=%d want 1", len(remaining))
	}
	if remaining[0].ID != keepID {
		t.Fatalf("kept id=%d want %d", remaining[0].ID, keepID)
	}
}

func TestLogRetentionKeepsForeverWhenDaysZero(t *testing.T) {
	db := setupRetentionDB(t)
	seedRetentionFixture(t, db, 0, 400*24*time.Hour)

	w := NewLogRetentionWorker(db)
	result := w.Run(context.Background(), "admin")
	if result.Deleted != 0 {
		t.Fatalf("deleted=%d want 0 (forever)", result.Deleted)
	}
	var count int64
	if err := db.Model(&models.Log{}).Count(&count).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 2 {
		t.Fatalf("count=%d want 2", count)
	}
}

func TestLogRetentionDeletesLogsWithAlertHistory(t *testing.T) {
	db := setupRetentionDB(t)
	_, keepID := seedRetentionFixture(t, db, 7, 10*24*time.Hour)

	var oldID int64
	if err := db.Raw(`SELECT id FROM logs WHERE message = ?`, "old").Scan(&oldID).Error; err != nil {
		t.Fatalf("old id: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO alert_histories (alert_rule_id, log_id, sent_at, status) VALUES (?,?,?,?)`,
		1, oldID, time.Now().UTC(), "success",
	).Error; err != nil {
		t.Fatalf("history: %v", err)
	}

	w := NewLogRetentionWorker(db)
	result := w.Run(context.Background(), "admin")
	if result.Error != "" {
		t.Fatalf("run error: %s", result.Error)
	}
	if result.Deleted != 1 {
		t.Fatalf("deleted=%d want 1", result.Deleted)
	}
	var remaining int64
	if err := db.Model(&models.Log{}).Count(&remaining).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	if remaining != 1 {
		t.Fatalf("remaining=%d want 1", remaining)
	}
	var kept models.Log
	if err := db.First(&kept, keepID).Error; err != nil {
		t.Fatalf("kept: %v", err)
	}

	var history models.AlertHistory
	if err := db.First(&history).Error; err != nil {
		t.Fatalf("history should be kept: %v", err)
	}
	if history.LogID != nil {
		t.Fatalf("history.log_id=%v want nil after log expiry", *history.LogID)
	}
}

func TestLogRetentionDisabledSkipsDelete(t *testing.T) {
	db := setupRetentionDB(t)
	seedRetentionFixture(t, db, 7, 10*24*time.Hour)

	w := NewLogRetentionWorker(db)
	if err := w.SetEnabled(context.Background(), false); err != nil {
		t.Fatalf("disable: %v", err)
	}
	result := w.Run(context.Background(), "cron")
	if result.Enabled {
		t.Fatal("expected enabled=false")
	}
	if result.Deleted != 0 {
		t.Fatalf("deleted=%d want 0", result.Deleted)
	}
	var count int64
	_ = db.Model(&models.Log{}).Count(&count)
	if count != 2 {
		t.Fatalf("count=%d want 2", count)
	}
}
