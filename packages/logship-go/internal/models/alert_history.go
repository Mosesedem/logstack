package models

import (
	"time"
)

type AlertStatus string

const (
	AlertStatusSuccess AlertStatus = "success"
	AlertStatusFailed  AlertStatus = "failed"
)

type AlertHistory struct {
	ID           uint        `gorm:"primaryKey" json:"id"`
	AlertRuleID  uint        `gorm:"index;not null" json:"alertRuleId"`
	LogID        *int64      `gorm:"index" json:"logId,omitempty"`
	SentAt       time.Time   `gorm:"default:CURRENT_TIMESTAMP" json:"sentAt"`
	Status       AlertStatus `gorm:"size:20;not null" json:"status"`
	ErrorMessage string      `gorm:"type:text" json:"errorMessage,omitempty"`

	// Relations
	AlertRule AlertRule `gorm:"foreignKey:AlertRuleID" json:"alertRule,omitempty"`
	Log       *Log      `gorm:"foreignKey:LogID" json:"log,omitempty"`
}
