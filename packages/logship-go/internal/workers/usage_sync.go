package workers

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services/notification"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// UsageSyncWorker periodically syncs usage counters from Redis to PostgreSQL
type UsageSyncWorker struct {
	db            *gorm.DB
	redis         *redis.Client
	emailNotifier *notification.EmailNotifier
	stopChan      chan struct{}
	interval      time.Duration
}

// NewUsageSyncWorker creates a new usage sync worker
func NewUsageSyncWorker(db *gorm.DB, redis *redis.Client, emailNotifier *notification.EmailNotifier, interval time.Duration) *UsageSyncWorker {
	if interval == 0 {
		interval = 1 * time.Minute // Default sync interval
	}
	return &UsageSyncWorker{
		db:            db,
		redis:         redis,
		emailNotifier: emailNotifier,
		stopChan:      make(chan struct{}),
		interval:      interval,
	}
}

// Start begins the periodic sync process
func (w *UsageSyncWorker) Start(ctx context.Context) {
	if w.redis == nil {
		log.Println("Usage sync worker disabled: Redis not available")
		return
	}

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	log.Printf("Usage sync worker started (interval: %s)", w.interval)

	// Run initial sync
	w.syncAll(ctx)

	for {
		select {
		case <-ctx.Done():
			log.Println("Usage sync worker stopped (context cancelled)")
			return
		case <-w.stopChan:
			log.Println("Usage sync worker stopped")
			return
		case <-ticker.C:
			w.syncAll(ctx)
		}
	}
}

// Stop gracefully stops the worker
func (w *UsageSyncWorker) Stop() {
	close(w.stopChan)
}

// syncAll syncs all usage counters from Redis to PostgreSQL
func (w *UsageSyncWorker) syncAll(ctx context.Context) {
	// Skip sync if Redis is not available
	if w.redis == nil {
		return
	}

	currentMonth := models.GetCurrentMonth()
	monthStr := currentMonth.Format("2006-01")

	// Find all usage keys for the current month
	usagePattern := "usage:" + monthStr + ":*"
	keys, err := w.redis.Keys(ctx, usagePattern).Result()
	if err != nil {
		log.Printf("Error scanning Redis keys: %v", err)
		return
	}

	if len(keys) == 0 {
		return
	}

	log.Printf("Syncing %d usage records to PostgreSQL", len(keys))

	for _, key := range keys {
		if err := w.syncProjectUsage(ctx, key, currentMonth); err != nil {
			log.Printf("Error syncing usage for key %s: %v", key, err)
		}
	}
}

// syncProjectUsage syncs a single project's usage to PostgreSQL
func (w *UsageSyncWorker) syncProjectUsage(ctx context.Context, usageKey string, month time.Time) error {
	// Parse project ID from key (format: usage:2026-01:uuid)
	parts := strings.Split(usageKey, ":")
	if len(parts) != 3 {
		return nil // Invalid key format
	}

	projectIDStr := parts[2]
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		return nil // Invalid UUID
	}

	// Get current values from Redis
	logCount, err := w.redis.Get(ctx, usageKey).Int64()
	if err != nil && err != redis.Nil {
		return err
	}

	bytesKey := "bytes:" + parts[1] + ":" + projectIDStr
	bytesIngested, err := w.redis.Get(ctx, bytesKey).Int64()
	if err != nil && err != redis.Nil {
		bytesIngested = 0 // Not critical if bytes tracking fails
	}

	// Upsert to PostgreSQL using GORM
	usageLog := models.UsageLog{
		ProjectID:     projectID,
		Month:         month,
		LogCount:      logCount,
		BytesIngested: bytesIngested,
		LastSyncedAt:  time.Now().UTC(),
	}

	// Use ON CONFLICT to upsert
	result := w.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "project_id"}, {Name: "month"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"log_count":      logCount,
			"bytes_ingested": bytesIngested,
			"last_synced_at": time.Now().UTC(),
			"updated_at":     time.Now().UTC(),
		}),
	}).Create(&usageLog)

	if result.Error != nil {
		return result.Error
	}

	return nil
}

// GetUserUsageSummary retrieves the usage summary for a user
func (w *UsageSyncWorker) GetUserUsageSummary(ctx context.Context, userID uint) (*models.UserUsageSummary, error) {
	currentMonth := models.GetCurrentMonth()

	// Get subscription tier
	var subscription models.Subscription
	if err := w.db.WithContext(ctx).
		Where("user_id = ?", userID).
		First(&subscription).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			subscription.Tier = models.TierFree
		} else {
			return nil, err
		}
	}

	// Aggregate usage from PostgreSQL
	var result struct {
		TotalLogCount      int64
		TotalBytesIngested int64
		ActiveProjects     int
	}

	err := w.db.WithContext(ctx).
		Table("usage_logs ul").
		Select("COALESCE(SUM(ul.log_count), 0) as total_log_count, COALESCE(SUM(ul.bytes_ingested), 0) as total_bytes_ingested, COUNT(DISTINCT ul.project_id) as active_projects").
		Joins("JOIN projects p ON ul.project_id = p.id").
		Where("p.owner_id = ? AND ul.month = ?", userID, currentMonth).
		Scan(&result).Error

	if err != nil {
		return nil, err
	}

	// Also check Redis for more recent counts not yet synced
	redisUsage, _ := w.getRedisUsageForUser(ctx, userID)
	if redisUsage > result.TotalLogCount {
		result.TotalLogCount = redisUsage
	}

	summary := &models.UserUsageSummary{
		UserID:             userID,
		Month:              currentMonth.Format("2006-01"),
		TotalLogCount:      result.TotalLogCount,
		TotalBytesIngested: result.TotalBytesIngested,
		ActiveProjects:     result.ActiveProjects,
		Tier:               subscription.Tier,
		LogLimit:           subscription.Tier.LogLimit(),
	}
	summary.CalculateUsagePercentage()

	// Check if we need to send usage alerts
	w.checkAndSendUsageAlerts(ctx, userID, summary)

	return summary, nil
}

// checkAndSendUsageAlerts checks usage thresholds and sends email alerts
func (w *UsageSyncWorker) checkAndSendUsageAlerts(ctx context.Context, userID uint, summary *models.UserUsageSummary) {
	if w.emailNotifier == nil {
		return
	}

	// Check 80% and 100% thresholds
	thresholds := []struct {
		percentage float64
		key        string
	}{
		{80, "80"},
		{100, "100"},
	}

	for _, threshold := range thresholds {
		if summary.UsagePercentage >= threshold.percentage {
			// Check if we've already sent an alert for this threshold this month
			alertKey := fmt.Sprintf("usage_alert:%d:%s:%s", userID, summary.Month, threshold.key)
			
			// Try to set key with 24-hour expiry
			set, err := w.redis.SetNX(ctx, alertKey, "1", 24*time.Hour).Result()
			if err != nil || !set {
				// Already sent or error - skip
				continue
			}

			// Get user details
			var user models.User
			if err := w.db.WithContext(ctx).First(&user, userID).Error; err != nil {
				log.Printf("Error fetching user for alert: %v", err)
				continue
			}

			// Send email alert
			if err := w.emailNotifier.SendUsageAlert(ctx, user.Email, user.Name, summary, threshold.percentage); err != nil {
				log.Printf("Error sending usage alert to user %d: %v", userID, err)
			} else {
				log.Printf("Sent %v%% usage alert to user %d (%s)", threshold.percentage, userID, user.Email)
			}
		}
	}
}

// getRedisUsageForUser gets the total usage from Redis for a user's projects
func (w *UsageSyncWorker) getRedisUsageForUser(ctx context.Context, userID uint) (int64, error) {
	var projectIDs []uuid.UUID
	if err := w.db.WithContext(ctx).Model(&models.Project{}).
		Where("owner_id = ?", userID).
		Pluck("id", &projectIDs).Error; err != nil {
		return 0, err
	}

	var totalUsage int64
	month := models.GetCurrentMonth().Format("2006-01")

	for _, projectID := range projectIDs {
		key := "usage:" + month + ":" + projectID.String()
		count, err := w.redis.Get(ctx, key).Int64()
		if err != nil && err != redis.Nil {
			continue
		}
		totalUsage += count
	}

	return totalUsage, nil
}

// ForceSync triggers an immediate sync for a specific project
func (w *UsageSyncWorker) ForceSync(ctx context.Context, projectID uuid.UUID) error {
	currentMonth := models.GetCurrentMonth()
	monthStr := currentMonth.Format("2006-01")
	usageKey := "usage:" + monthStr + ":" + projectID.String()
	
	return w.syncProjectUsage(ctx, usageKey, currentMonth)
}
