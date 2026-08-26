package models

import "time"

const (
	SettingLogRetentionEnabled = "log_retention.enabled"
	SettingLogRetentionLastRun = "log_retention.last_run"
)

// SystemSetting is a platform-wide key/value row editable by admins.
type SystemSetting struct {
	Key       string    `gorm:"primaryKey;size:64" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (SystemSetting) TableName() string {
	return "system_settings"
}
