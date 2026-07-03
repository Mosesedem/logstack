package services

import (
	"time"

	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

type QueryBuilder struct {
	db *gorm.DB
}

func NewQueryBuilder(db *gorm.DB) *QueryBuilder {
	return &QueryBuilder{db: db}
}

type QueryOptions struct {
	ProjectID uuid.UUID
	Offset    int
	Limit     int
	Level     string
	Source    string
	Search    string
	StartTime *time.Time
	EndTime   *time.Time
}

func (q *QueryBuilder) Query(opts QueryOptions) (*models.LogQueryResponse, error) {
	// Set defaults
	if opts.Limit == 0 {
		opts.Limit = 50
	}
	if opts.Limit > 100 {
		opts.Limit = 100
	}

	query := q.db.Model(&models.Log{}).Where("project_id = ?", opts.ProjectID)

	// Apply filters
	if opts.Level != "" {
		query = query.Where("level = ?", opts.Level)
	}

	if opts.Source != "" {
		query = query.Where("source = ?", opts.Source)
	}

	if opts.Search != "" {
		query = query.Where("message ILIKE ?", "%"+opts.Search+"%")
	}

	if opts.StartTime != nil {
		query = query.Where("created_at >= ?", opts.StartTime)
	}

	if opts.EndTime != nil {
		query = query.Where("created_at <= ?", opts.EndTime)
	}

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	// Get paginated results
	var logs []models.Log
	if err := query.Order("created_at DESC").
		Offset(opts.Offset).
		Limit(opts.Limit + 1). // Fetch one extra to check hasMore
		Find(&logs).Error; err != nil {
		return nil, err
	}

	// Check if there are more results
	hasMore := len(logs) > opts.Limit
	if hasMore {
		logs = logs[:opts.Limit]
	}

	return &models.LogQueryResponse{
		Logs:    logs,
		Total:   total,
		Offset:  opts.Offset,
		HasMore: hasMore,
	}, nil
}

// Analytics returns aggregated log analytics for the given project over the last N hours.
func (q *QueryBuilder) Analytics(projectID uuid.UUID, hours int) (*models.LogAnalyticsResponse, error) {
	since := time.Now().UTC().Add(-time.Duration(hours) * time.Hour)

	// COUNT(*) grouped by level
	type levelCount struct {
		Level string
		Count int64
	}
	var levelCounts []levelCount
	if err := q.db.Raw(
		`SELECT level, COUNT(*) as count FROM logs WHERE project_id = ? AND created_at >= ? GROUP BY level`,
		projectID, since,
	).Scan(&levelCounts).Error; err != nil {
		return nil, err
	}

	countByLevel := make(map[string]int64)
	var totalCount int64
	for _, lc := range levelCounts {
		countByLevel[lc.Level] = lc.Count
		totalCount += lc.Count
	}

	// Compute error rate from error, critical, fatal counts
	var errorCount int64
	for _, lvl := range []string{"error", "critical", "fatal"} {
		errorCount += countByLevel[lvl]
	}
	var errorRate float64
	if totalCount > 0 {
		errorRate = float64(errorCount) / float64(totalCount) * 100
	}

	// COUNT(*) grouped by hour for time series
	type hourCount struct {
		Ts    time.Time
		Count int64
	}
	var hourCounts []hourCount
	if err := q.db.Raw(
		`SELECT date_trunc('hour', created_at) as ts, COUNT(*) as count FROM logs WHERE project_id = ? AND created_at >= ? GROUP BY ts ORDER BY ts`,
		projectID, since,
	).Scan(&hourCounts).Error; err != nil {
		return nil, err
	}

	// Build a map from truncated-hour → count for zero-filling
	hourMap := make(map[string]int64, hours)
	for _, hc := range hourCounts {
		key := hc.Ts.UTC().Truncate(time.Hour).Format(time.RFC3339)
		hourMap[key] = hc.Count
	}

	// Zero-fill all hourly buckets from oldest to newest
	timeSeries := make([]models.TimeSeriesBucket, hours)
	for i := 0; i < hours; i++ {
		bucketTime := time.Now().UTC().Truncate(time.Hour).Add(-time.Duration(hours-1-i) * time.Hour)
		key := bucketTime.Format(time.RFC3339)
		timeSeries[i] = models.TimeSeriesBucket{
			Timestamp: key,
			Count:     hourMap[key],
		}
	}

	return &models.LogAnalyticsResponse{
		TotalCount:   totalCount,
		CountByLevel: countByLevel,
		ErrorRate:    errorRate,
		TimeSeries:   timeSeries,
	}, nil
}

func (q *QueryBuilder) GetByID(id int64, projectID uuid.UUID) (*models.Log, error) {
	var log models.Log
	if err := q.db.Where("id = ? AND project_id = ?", id, projectID).First(&log).Error; err != nil {
		return nil, err
	}
	return &log, nil
}
