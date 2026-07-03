package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type AlertChannel string

const (
	AlertChannelEmail   AlertChannel = "email"
	AlertChannelPush    AlertChannel = "push"
	AlertChannelWebhook AlertChannel = "webhook"
)

type AlertRule struct {
	ID              uint                      `gorm:"primaryKey" json:"id"`
	ProjectID       uuid.UUID                 `gorm:"type:uuid;index;not null" json:"projectId"`
	Name            string                    `gorm:"size:100;not null" json:"name"`
	TriggerPattern  string                    `gorm:"size:500" json:"triggerPattern,omitempty"` // kept for DB compatibility
	TriggerPatterns datatypes.JSONSlice[string] `gorm:"type:jsonb" json:"triggerPatterns"`
	TriggerLevel    LogLevel                  `gorm:"size:10" json:"triggerLevel,omitempty"`
	Channel         AlertChannel              `gorm:"size:20" json:"channel,omitempty"` // kept for DB compatibility
	Channels        datatypes.JSONSlice[string] `gorm:"type:jsonb" json:"channels"`
	Recipient       string                    `gorm:"type:text;not null" json:"recipient"`
	CooldownMinutes int                       `gorm:"default:15" json:"cooldownMinutes"`
	Enabled         bool                      `gorm:"default:true" json:"enabled"`
	CreatedAt       time.Time                 `json:"createdAt"`
	UpdatedAt       time.Time                 `json:"updatedAt"`

	// Relations
	Project      Project        `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	AlertHistory []AlertHistory `gorm:"foreignKey:AlertRuleID" json:"alertHistory,omitempty"`
}

// AlertOptionsResponse is returned by GET /v1/alerts/options
type AlertOptionsResponse struct {
	Channels        []string `json:"channels"`
	TriggerPatterns []string `json:"triggerPatterns"`
	TriggerLevels   []string `json:"triggerLevels"`
	CooldownOptions []int    `json:"cooldownOptions"`
}

type AlertRuleCreateRequest struct {
	Name            string       `json:"name" binding:"required,max=100"`
	TriggerPattern  string       `json:"triggerPattern,omitempty" binding:"omitempty,max=500"`
	TriggerPatterns []string     `json:"triggerPatterns,omitempty"`
	TriggerLevel    LogLevel     `json:"triggerLevel,omitempty"`
	Channel         AlertChannel `json:"channel,omitempty"`
	Channels        []string     `json:"channels,omitempty"`
	Recipient       string       `json:"recipient"`
	CooldownMinutes int          `json:"cooldownMinutes" binding:"min=0"`
	Enabled         *bool        `json:"enabled"`
}

type AlertRuleUpdateRequest struct {
	Name            *string       `json:"name,omitempty" binding:"omitempty,max=100"`
	TriggerPattern  *string       `json:"triggerPattern,omitempty" binding:"omitempty,max=500"`
	TriggerPatterns []string      `json:"triggerPatterns,omitempty"`
	TriggerLevel    *LogLevel     `json:"triggerLevel,omitempty"`
	Channel         *AlertChannel `json:"channel,omitempty"`
	Channels        []string      `json:"channels,omitempty"`
	Recipient       *string       `json:"recipient,omitempty"`
	CooldownMinutes *int          `json:"cooldownMinutes,omitempty" binding:"omitempty,min=0"`
	Enabled         *bool         `json:"enabled,omitempty"`
}
