package workers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const logRetentionInterval = 24 * time.Hour

// RetentionTierResult is the per-tier outcome of one cleanup pass.
type RetentionTierResult struct {
	Tier           string `json:"tier"`
	RetentionDays  int    `json:"retentionDays"`
	Deleted        int    `json:"deleted"`
	SkippedForever bool   `json:"skippedForever,omitempty"`
}

// RetentionRunResult is persisted after each cleanup (cron or admin-triggered).
type RetentionRunResult struct {
	RanAt     time.Time             `json:"ranAt"`
	Enabled   bool                  `json:"enabled"`
	Deleted   int                   `json:"deleted"`
	Tiers     []RetentionTierResult `json:"tiers"`
	Error     string                `json:"error,omitempty"`
	Triggered string                `json:"triggered"` // "cron" | "admin" | "startup"
}

// LogRetentionWorker deletes logs older than the admin-configured retention window.
type LogRetentionWorker struct {
	db       *gorm.DB
	stopChan chan struct{}
	mu       sync.Mutex
}

// NewLogRetentionWorker creates a new log retention worker.
func NewLogRetentionWorker(db *gorm.DB) *LogRetentionWorker {
	return &LogRetentionWorker{
		db:       db,
		stopChan: make(chan struct{}),
	}
}

// Start runs cleanup immediately, then once per day.
func (w *LogRetentionWorker) Start(ctx context.Context) {
	slog.Info("log retention worker started", "interval", logRetentionInterval.String())
	w.Run(ctx, "startup")

	ticker := time.NewTicker(logRetentionInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("log retention worker stopped")
			return
		case <-w.stopChan:
			slog.Info("log retention worker stopped")
			return
		case <-ticker.C:
			w.Run(ctx, "cron")
		}
	}
}

// Stop stops the log retention worker.
func (w *LogRetentionWorker) Stop() {
	close(w.stopChan)
}

// Interval is the cron cadence (exposed to the admin API).
func (w *LogRetentionWorker) Interval() time.Duration {
	return logRetentionInterval
}

// Run executes one cleanup pass. Concurrent runs are serialized.
func (w *LogRetentionWorker) Run(ctx context.Context, triggered string) RetentionRunResult {
	w.mu.Lock()
	defer w.mu.Unlock()

	result := RetentionRunResult{
		RanAt:     time.Now().UTC(),
		Triggered: triggered,
		Tiers:     []RetentionTierResult{},
	}

	enabled, err := w.isEnabled(ctx)
	if err != nil {
		result.Error = err.Error()
		slog.Error("log retention: failed to read enabled flag", "error", err)
		w.persistResult(ctx, result)
		return result
	}
	result.Enabled = enabled
	if !enabled {
		slog.Info("log retention skipped (disabled by admin)")
		w.persistResult(ctx, result)
		return result
	}

	daysByTier, err := w.retentionByTier(ctx)
	if err != nil {
		result.Error = err.Error()
		slog.Error("log retention: failed to load plan windows", "error", err)
		w.persistResult(ctx, result)
		return result
	}

	projectsByTier, err := w.projectsByTier(ctx)
	if err != nil {
		result.Error = err.Error()
		slog.Error("log retention: failed to load projects", "error", err)
		w.persistResult(ctx, result)
		return result
	}

	totalDeleted := 0
	for tier, days := range daysByTier {
		row := RetentionTierResult{Tier: tier, RetentionDays: days}
		ids := projectsByTier[tier]
		if days <= 0 {
			row.SkippedForever = true
			result.Tiers = append(result.Tiers, row)
			continue
		}
		if len(ids) == 0 {
			result.Tiers = append(result.Tiers, row)
			continue
		}
		deleted, delErr := w.deleteExpired(ctx, ids, days)
		if delErr != nil {
			slog.Error("log retention: delete failed", "tier", tier, "error", delErr)
			if result.Error == "" {
				result.Error = delErr.Error()
			}
		}
		row.Deleted = deleted
		totalDeleted += deleted
		result.Tiers = append(result.Tiers, row)
		slog.Info("deleted expired logs", "tier", tier, "retentionDays", days, "deleted", deleted)
	}

	result.Deleted = totalDeleted
	slog.Info("log retention cleanup complete", "totalDeleted", totalDeleted, "triggered", triggered)
	w.persistResult(ctx, result)
	return result
}

// LastRun returns the most recently persisted cleanup result.
func (w *LogRetentionWorker) LastRun(ctx context.Context) (*RetentionRunResult, error) {
	var setting models.SystemSetting
	err := w.db.WithContext(ctx).First(&setting, "key = ?", models.SettingLogRetentionLastRun).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	var out RetentionRunResult
	if err := json.Unmarshal([]byte(setting.Value), &out); err != nil {
		return nil, fmt.Errorf("decode last run: %w", err)
	}
	return &out, nil
}

// IsEnabled reports whether automatic deletion is on.
func (w *LogRetentionWorker) IsEnabled(ctx context.Context) (bool, error) {
	return w.isEnabled(ctx)
}

// SetEnabled stores the admin kill switch.
func (w *LogRetentionWorker) SetEnabled(ctx context.Context, enabled bool) error {
	val := "false"
	if enabled {
		val = "true"
	}
	return w.upsertSetting(ctx, models.SettingLogRetentionEnabled, val)
}

func (w *LogRetentionWorker) isEnabled(ctx context.Context) (bool, error) {
	var setting models.SystemSetting
	err := w.db.WithContext(ctx).First(&setting, "key = ?", models.SettingLogRetentionEnabled).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return true, nil
		}
		return false, err
	}
	return setting.Value != "false" && setting.Value != "0", nil
}

func (w *LogRetentionWorker) retentionByTier(ctx context.Context) (map[string]int, error) {
	out := map[string]int{
		string(models.TierFree):       models.DefaultRetentionDays(models.TierFree),
		string(models.TierStarter):    models.DefaultRetentionDays(models.TierStarter),
		string(models.TierPro):        models.DefaultRetentionDays(models.TierPro),
		string(models.TierEnterprise): models.DefaultRetentionDays(models.TierEnterprise),
	}
	var plans []models.PricingPlan
	if err := w.db.WithContext(ctx).Find(&plans).Error; err != nil {
		return nil, err
	}
	for _, plan := range plans {
		out[plan.Tier] = plan.RetentionDays
	}
	return out, nil
}

func (w *LogRetentionWorker) projectsByTier(ctx context.Context) (map[string][]uuid.UUID, error) {
	type row struct {
		ID   uuid.UUID `gorm:"column:id"`
		Tier string    `gorm:"column:tier"`
	}
	var rows []row
	err := w.db.WithContext(ctx).Raw(`
		SELECT p.id,
		       COALESCE(s.tier, 'free') AS tier
		FROM projects p
		LEFT JOIN subscriptions s
		  ON s.user_id = p.owner_id
		 AND s.status IN ('active', 'trialing')
	`).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := map[string][]uuid.UUID{}
	for _, r := range rows {
		tier := r.Tier
		if tier == "" {
			tier = string(models.TierFree)
		}
		out[tier] = append(out[tier], r.ID)
	}
	return out, nil
}

func (w *LogRetentionWorker) deleteExpired(ctx context.Context, projectIDs []uuid.UUID, retentionDays int) (int, error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	result := w.db.WithContext(ctx).
		Where("project_id IN ? AND created_at < ?", projectIDs, cutoff).
		Delete(&models.Log{})
	return int(result.RowsAffected), result.Error
}

func (w *LogRetentionWorker) persistResult(ctx context.Context, result RetentionRunResult) {
	b, err := json.Marshal(result)
	if err != nil {
		slog.Error("log retention: failed to encode run result", "error", err)
		return
	}
	if err := w.upsertSetting(ctx, models.SettingLogRetentionLastRun, string(b)); err != nil {
		slog.Error("log retention: failed to persist run result", "error", err)
	}
}

func (w *LogRetentionWorker) upsertSetting(ctx context.Context, key, value string) error {
	row := models.SystemSetting{Key: key, Value: value, UpdatedAt: time.Now().UTC()}
	return w.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&row).Error
}

// CountExpired returns how many logs would be deleted with the current windows.
func (w *LogRetentionWorker) CountExpired(ctx context.Context) (int64, error) {
	daysByTier, err := w.retentionByTier(ctx)
	if err != nil {
		return 0, err
	}
	projectsByTier, err := w.projectsByTier(ctx)
	if err != nil {
		return 0, err
	}
	var total int64
	for tier, days := range daysByTier {
		if days <= 0 {
			continue
		}
		ids := projectsByTier[tier]
		if len(ids) == 0 {
			continue
		}
		cutoff := time.Now().UTC().AddDate(0, 0, -days)
		var n int64
		if err := w.db.WithContext(ctx).Model(&models.Log{}).
			Where("project_id IN ? AND created_at < ?", ids, cutoff).
			Count(&n).Error; err != nil {
			return 0, err
		}
		total += n
	}
	return total, nil
}
