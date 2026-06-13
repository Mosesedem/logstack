package services

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Ingestor struct {
	db    *gorm.DB
	redis *redis.Client
}

func NewIngestor(db *gorm.DB, redis *redis.Client) *Ingestor {
	return &Ingestor{
		db:    db,
		redis: redis,
	}
}

// trackUsage increments the usage counter in Redis for the project
func (i *Ingestor) trackUsage(ctx context.Context, projectID uuid.UUID, logCount int, bytesIngested int64) {
	if i.redis == nil {
		return
	}

	// Get Redis keys for current month
	usageKey := models.RedisUsageKey(projectID)
	bytesKey := models.RedisBytesKey(projectID)

	// Use pipeline for atomic increment
	pipe := i.redis.Pipeline()
	pipe.IncrBy(ctx, usageKey, int64(logCount))
	pipe.IncrBy(ctx, bytesKey, bytesIngested)

	// Set expiry to end of next month (to ensure data persists through sync)
	now := time.Now().UTC()
	nextMonthEnd := time.Date(now.Year(), now.Month()+2, 1, 0, 0, 0, 0, time.UTC)
	pipe.ExpireAt(ctx, usageKey, nextMonthEnd)
	pipe.ExpireAt(ctx, bytesKey, nextMonthEnd)

	pipe.Exec(ctx)
}

// calculateBatchSize estimates the total bytes for a batch of logs
func (i *Ingestor) calculateBatchSize(logs []models.Log) int64 {
	var totalBytes int64
	for _, log := range logs {
		// Estimate size: message + metadata + overhead
		totalBytes += int64(len(log.Message))
		if log.Metadata != nil {
			totalBytes += int64(len(log.Metadata))
		}
		totalBytes += 100 // Overhead for other fields
	}
	return totalBytes
}

// IngestBatch validates and saves logs in a transaction
func (i *Ingestor) IngestBatch(ctx context.Context, projectID uuid.UUID, logs []models.LogCreateRequest) ([]models.Log, error) {
	// Validate batch size
	if len(logs) > 1000 {
		return nil, errors.New("batch size exceeds 1000")
	}

	if len(logs) == 0 {
		return nil, errors.New("no logs provided")
	}

	// Convert to Log models
	logModels := make([]models.Log, len(logs))
	for idx, logReq := range logs {
		// Validate log level
		if !logReq.Level.IsValid() {
			return nil, errors.New("invalid log level: " + string(logReq.Level))
		}

		var metadata json.RawMessage
		if logReq.Metadata != nil {
			metadataBytes, err := json.Marshal(logReq.Metadata)
			if err != nil {
				return nil, errors.New("invalid metadata")
			}
			metadata = metadataBytes
		}

		logModels[idx] = models.Log{
			ProjectID: projectID,
			Level:     logReq.Level,
			Message:   logReq.Message,
			Metadata:  metadata,
			Source:    logReq.Source,
		}
	}

	// Load project to check environment
	var project models.Project
	if err := i.db.WithContext(ctx).First(&project, "id = ?", projectID).Error; err != nil {
		return nil, err
	}

	// If project is not production, still publish to Redis for real-time streaming
	// but do not persist to DB and do not track usage.
	// The API response includes "ephemeral: true" so clients know logs won't be queryable.
	if project.Environment != "production" {
		now := time.Now().UTC()
		for idx := range logModels {
			logModels[idx].CreatedAt = now
		}
		go i.publishLogs(ctx, projectID, logModels)
		return logModels, nil
	}

	// Start transaction
	tx := i.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Bulk insert with batching
	if err := tx.CreateInBatches(logModels, 100).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// Track usage in Redis for billing (async to not block response)
	go func() {
		bytesIngested := i.calculateBatchSize(logModels)
		i.trackUsage(context.Background(), projectID, len(logModels), bytesIngested)
	}()

	// Publish to Redis for real-time streaming
	go i.publishLogs(ctx, projectID, logModels)

	return logModels, nil
}

func (i *Ingestor) publishLogs(ctx context.Context, projectID uuid.UUID, logs []models.Log) {
	channel := "logs:" + projectID.String()
	for _, log := range logs {
		payload, err := json.Marshal(log)
		if err != nil {
			continue // Log error but continue
		}
		i.redis.Publish(ctx, channel, payload)
	}
}

// IngestSingle ingests a single log
func (i *Ingestor) IngestSingle(ctx context.Context, projectID uuid.UUID, logReq models.LogCreateRequest) (*models.Log, error) {
	logs, err := i.IngestBatch(ctx, projectID, []models.LogCreateRequest{logReq})
	if err != nil {
		return nil, err
	}
	return &logs[0], nil
}

// GetDB returns the underlying database connection (used by handlers for supplemental queries)
func (i *Ingestor) GetDB() *gorm.DB {
	return i.db
}
