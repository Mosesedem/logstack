package workers

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"gorm.io/gorm"
)

type AlertProcessor struct {
	db          *gorm.DB
	alertEngine *services.AlertEngine
	stopChan    chan struct{}
}

func NewAlertProcessor(db *gorm.DB, alertEngine *services.AlertEngine) *AlertProcessor {
	return &AlertProcessor{
		db:          db,
		alertEngine: alertEngine,
		stopChan:    make(chan struct{}),
	}
}

func (p *AlertProcessor) Start(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	slog.Info("Alert processor started")

	for {
		select {
		case <-ctx.Done():
			slog.Info("Alert processor stopped")
			return
		case <-p.stopChan:
			slog.Info("Alert processor stopped")
			return
		case <-ticker.C:
			p.processUnprocessedLogs(ctx)
		}
	}
}

func (p *AlertProcessor) Stop() {
	close(p.stopChan)
}

func (p *AlertProcessor) processUnprocessedLogs(ctx context.Context) {
	// Get recent unprocessed logs (all levels, not just error/critical)
	// Note: This is a temporary implementation. In production, add a processed_for_alerts column
	var logs []models.Log
	if err := p.db.WithContext(ctx).
		Where("created_at > ?", time.Now().Add(-1*time.Minute)).
		Order("created_at ASC").
		Limit(100).
		Find(&logs).Error; err != nil {
		slog.Error("Error fetching logs for alert processing", "error", err)
		return
	}

	for _, l := range logs {
		if err := p.alertEngine.ProcessLog(ctx, &l); err != nil {
			slog.Error("Error processing log for alerts", "logId", l.ID, "error", err)
		}
	}
}

// ProcessLogAsync processes a single log asynchronously
func (p *AlertProcessor) ProcessLogAsync(logData []byte) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var l models.Log
		if err := json.Unmarshal(logData, &l); err != nil {
			slog.Error("Error unmarshaling log", "error", err)
			return
		}

		if err := p.alertEngine.ProcessLog(ctx, &l); err != nil {
			slog.Error("Error processing log for alerts", "error", err)
		}
	}()
}
