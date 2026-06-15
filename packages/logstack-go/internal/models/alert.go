package models

import (
	"time"

	"github.com/google/uuid"
)

type AlertChannel string

const (
	AlertChannelEmail   AlertChannel = "email"
	AlertChannelPush    AlertChannel = "push"
	AlertChannelWebhook AlertChannel = "webhook"
)

type AlertRule struct {
	ID              uint         `gorm:"primaryKey" json:"id"`
	ProjectID       uuid.UUID    `gorm:"type:uuid;index;not null" json:"projectId"`
	Name            string       `gorm:"size:100;not null" json:"name"`
	TriggerPattern  string       `gorm:"size:500;not null" json:"triggerPattern"`
	TriggerLevel    LogLevel     `gorm:"size:10" json:"triggerLevel,omitempty"`
	Channel         AlertChannel `gorm:"size:20;not null" json:"channel"`
	Recipient       string       `gorm:"type:text;not null" json:"recipient"`
	CooldownMinutes int          `gorm:"default:15" json:"cooldownMinutes"`
	Enabled         bool         `gorm:"default:true" json:"enabled"`
	CreatedAt       time.Time    `json:"createdAt"`
	UpdatedAt       time.Time    `json:"updatedAt"`

	// Relations
	Project      Project        `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	AlertHistory []AlertHistory `gorm:"foreignKey:AlertRuleID" json:"alertHistory,omitempty"`
}

type AlertRuleCreateRequest struct {
	Name            string       `json:"name" binding:"required,max=100"`
	TriggerPattern  string       `json:"triggerPattern" binding:"required,max=500"`
	TriggerLevel    LogLevel     `json:"triggerLevel,omitempty"`
	Channel         AlertChannel `json:"channel" binding:"required"`
	Recipient       string       `json:"recipient" binding:"required"`
	CooldownMinutes int          `json:"cooldownMinutes" binding:"min=0"`
	Enabled         *bool        `json:"enabled"`
}

type AlertRuleUpdateRequest struct {
	Name            *string       `json:"name,omitempty" binding:"omitempty,max=100"`
	TriggerPattern  *string       `json:"triggerPattern,omitempty" binding:"omitempty,max=500"`
	TriggerLevel    *LogLevel     `json:"triggerLevel,omitempty"`
	Channel         *AlertChannel `json:"channel,omitempty"`
	Recipient       *string       `json:"recipient,omitempty"`
	CooldownMinutes *int          `json:"cooldownMinutes,omitempty" binding:"omitempty,min=0"`
	Enabled         *bool         `json:"enabled,omitempty"`
}
