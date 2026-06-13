package workers

import (
	"context"
	"log/slog"
	"time"

	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// LogRetentionWorker handles automatic log deletion based on subscription tiers
type LogRetentionWorker struct {
	db       *gorm.DB
	stopChan chan struct{}
}

// NewLogRetentionWorker creates a new log retention worker
func NewLogRetentionWorker(db *gorm.DB) *LogRetentionWorker {
	return &LogRetentionWorker{
		db:       db,
		stopChan: make(chan struct{}),
	}
}

// Start begins the log retention worker
func (w *LogRetentionWorker) Start(ctx context.Context) {
	// Run daily at 2am UTC
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	slog.Info("Log retention worker started")

	for {
		select {
		case <-ctx.Done():
			slog.Info("Log retention worker stopped")
			return
		case <-w.stopChan:
			slog.Info("Log retention worker stopped")
			return
		case <-ticker.C:
			w.cleanupExpiredLogs(ctx)
		}
	}
}

// Stop stops the log retention worker
func (w *LogRetentionWorker) Stop() {
	close(w.stopChan)
}

// cleanupExpiredLogs deletes logs older than the retention period for each subscription tier
func (w *LogRetentionWorker) cleanupExpiredLogs(ctx context.Context) {
	slog.Info("Starting log retention cleanup")

	// Define retention periods by tier (in days)
	retentionPeriods := map[models.SubscriptionTier]int{
		models.TierFree:       7,   // 7 days
		models.TierStarter:    30,  // 30 days
		models.TierPro:        90,  // 90 days
		models.TierEnterprise: 365, // 365 days
	}

	totalDeleted := 0

	for tier, retentionDays := range retentionPeriods {
		deleted, err := w.deleteExpiredLogsForTier(ctx, tier, retentionDays)
		if err != nil {
			slog.Error("Error deleting expired logs", "tier", tier, "error", err)
			continue
		}
		totalDeleted += deleted
		slog.Info("Deleted expired logs", "tier", tier, "retentionDays", retentionDays, "deleted", deleted)
	}

	slog.Info("Log retention cleanup complete", "totalDeleted", totalDeleted)
}

// deleteExpiredLogsForTier deletes logs older than retentionDays for projects with the given tier
func (w *LogRetentionWorker) deleteExpiredLogsForTier(ctx context.Context, tier models.SubscriptionTier, retentionDays int) (int, error) {
	cutoffTime := time.Now().AddDate(0, 0, -retentionDays)

	// Find all projects with this tier
	var projects []models.Project
	if err := w.db.WithContext(ctx).
		Joins("JOIN subscriptions ON subscriptions.user_id = projects.owner_id").
		Where("subscriptions.tier = ?", tier).
		Find(&projects).Error; err != nil {
		return 0, err
	}

	totalDeleted := 0

	for _, project := range projects {
		// Delete logs older than cutoff time for this project
		result := w.db.WithContext(ctx).
			Where("project_id = ? AND created_at < ?", project.ID, cutoffTime).
			Delete(&models.Log{})
		
		deleted := int(result.RowsAffected)
		totalDeleted += deleted
	}

	return totalDeleted, nil
}

// CleanupLogsForProject deletes logs older than retentionDays for a specific project
func (w *LogRetentionWorker) CleanupLogsForProject(ctx context.Context, projectID string, retentionDays int) (int, error) {
	cutoffTime := time.Now().AddDate(0, 0, -retentionDays)

	result := w.db.WithContext(ctx).
		Where("project_id = ? AND created_at < ?", projectID, cutoffTime).
		Delete(&models.Log{})

	return int(result.RowsAffected), result.Error
}
