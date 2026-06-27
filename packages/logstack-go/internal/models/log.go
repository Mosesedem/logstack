package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type LogLevel string

const (
	LogLevelDebug    LogLevel = "debug"
	LogLevelInfo     LogLevel = "info"
	LogLevelWarn     LogLevel = "warn"
	LogLevelError    LogLevel = "error"
	LogLevelCritical LogLevel = "critical"
	LogLevelFatal    LogLevel = "fatal"
)

func (l LogLevel) IsValid() bool {
	switch l {
	case LogLevelDebug, LogLevelInfo, LogLevelWarn, LogLevelError, LogLevelCritical, LogLevelFatal:
		return true
	}
	return false
}

type Log struct {
	ID        int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID uuid.UUID       `gorm:"type:uuid;index:idx_logs_project_created;not null" json:"projectId"`
	Level     LogLevel        `gorm:"size:10;not null;index:idx_logs_level" json:"level"`
	Message   string          `gorm:"type:text;not null" json:"message"`
	Metadata  json.RawMessage `gorm:"type:jsonb" json:"metadata,omitempty"`
	Source    string          `gorm:"size:100" json:"source,omitempty"`
	CreatedAt time.Time       `gorm:"index:idx_logs_project_created" json:"createdAt"`

	// Relations
	Project Project `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
}

type LogCreateRequest struct {
	Level    LogLevel               `json:"level" binding:"required"`
	Message  string                 `json:"message" binding:"required"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Source   string                 `json:"source,omitempty"`
}

type LogBatchRequest struct {
	Logs []LogCreateRequest `json:"logs" binding:"required,min=1,max=1000"`
}

type LogQueryRequest struct {
	ProjectID string   `form:"projectId" binding:"required"`
	Offset    int      `form:"offset" binding:"min=0"`
	Limit     int      `form:"limit" binding:"min=1,max=100"`
	Level     string   `form:"level"`
	Search    string   `form:"search"`
	StartTime string   `form:"startTime"`
	EndTime   string   `form:"endTime"`
}

type LogQueryResponse struct {
	Logs    []Log `json:"logs"`
	Total   int64 `json:"total"`
	Offset  int   `json:"offset"`
	HasMore bool  `json:"hasMore"`
}
