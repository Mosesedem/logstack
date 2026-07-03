package models

import (
	"time"

	"github.com/google/uuid"
)

// LogEscalation records that a user flagged a log for immediate attention.
type LogEscalation struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	LogID     int64     `gorm:"not null;uniqueIndex:idx_log_escalations_log_user" json:"logId"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null;index" json:"projectId"`
	UserID    uint      `gorm:"not null;uniqueIndex:idx_log_escalations_log_user" json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
}

type LogEscalationResponse struct {
	Escalated   bool     `json:"escalated"`
	AlreadyDone bool     `json:"alreadyDone"`
	Notified    []string `json:"notified"`
	Message     string   `json:"message"`
}