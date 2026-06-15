package models

import (
	"time"

	"github.com/google/uuid"
)

// UsageLog tracks monthly log ingestion per project
type UsageLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ProjectID     uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:unique_project_month" json:"projectId"`
	Month         time.Time `gorm:"type:date;not null;uniqueIndex:unique_project_month" json:"month"`
	LogCount      int64     `gorm:"default:0" json:"logCount"`
	BytesIngested int64     `gorm:"default:0" json:"bytesIngested"`
	LastSyncedAt  time.Time `json:"lastSyncedAt"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`

	// Relations
	Project Project `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
}

// TableName specifies the table name for GORM
func (UsageLog) TableName() string {
	return "usage_logs"
}

// UsageLogResponse is the API response for usage logs
type UsageLogResponse struct {
	ProjectID     uuid.UUID `json:"projectId"`
	Month         string    `json:"month"`
	LogCount      int64     `json:"logCount"`
	BytesIngested int64     `json:"bytesIngested"`
}

// ToResponse converts a UsageLog to UsageLogResponse
func (u *UsageLog) ToResponse() UsageLogResponse {
	return UsageLogResponse{
		ProjectID:     u.ProjectID,
		Month:         u.Month.Format("2006-01"),
		LogCount:      u.LogCount,
		BytesIngested: u.BytesIngested,
	}
}

// UserUsageSummary represents aggregated usage for a user across all projects
type UserUsageSummary struct {
	UserID             uint               `json:"userId"`
	Month              string             `json:"month"`
	TotalLogCount      int64              `json:"totalLogCount"`
	TotalBytesIngested int64              `json:"totalBytesIngested"`
	ActiveProjects     int                `json:"activeProjects"`
	Tier               SubscriptionTier   `json:"tier"`
	LogLimit           int64              `json:"logLimit"`
	UsagePercentage    float64            `json:"usagePercentage"`
	IsOverLimit        bool               `json:"isOverLimit"`
}

// CalculateUsagePercentage calculates the usage percentage based on tier limits
func (u *UserUsageSummary) CalculateUsagePercentage() {
	if u.LogLimit <= 0 {
		// Unlimited (enterprise) or error
		u.UsagePercentage = 0
		u.IsOverLimit = false
		return
	}
	u.UsagePercentage = float64(u.TotalLogCount) / float64(u.LogLimit) * 100
	u.IsOverLimit = u.TotalLogCount >= u.LogLimit
}

// GetCurrentMonth returns the first day of the current month
func GetCurrentMonth() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// GetMonthFromDate returns the first day of the month for a given date
func GetMonthFromDate(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// RedisUsageKey returns the Redis key for tracking project usage
func RedisUsageKey(projectID uuid.UUID) string {
	month := GetCurrentMonth().Format("2006-01")
	return "usage:" + month + ":" + projectID.String()
}

// RedisBytesKey returns the Redis key for tracking project bytes ingested
func RedisBytesKey(projectID uuid.UUID) string {
	month := GetCurrentMonth().Format("2006-01")
	return "bytes:" + month + ":" + projectID.String()
}
