package models

import (
	"time"
)

type DeviceType string

const (
	DeviceTypeIOS     DeviceType = "ios"
	DeviceTypeAndroid DeviceType = "android"
)

type PushToken struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"index;not null" json:"userId"`
	Token      string     `gorm:"uniqueIndex;type:text;not null" json:"token"`
	DeviceType DeviceType `gorm:"size:10;not null" json:"deviceType"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type PushTokenCreateRequest struct {
	Token      string     `json:"token" binding:"required"`
	DeviceType DeviceType `json:"deviceType" binding:"required"`
}

// DeviceView is the dashboard-safe shape of a registered push device (no raw FCM token).
type DeviceView struct {
	ID          uint       `json:"id"`
	DeviceType  DeviceType `json:"deviceType"`
	MaskedToken string     `json:"maskedToken"`
	LastSeenAt  time.Time  `json:"lastSeenAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// MaskPushToken redacts an FCM token for logs and the dashboard.
func MaskPushToken(token string) string {
	if len(token) <= 20 {
		return "***"
	}
	return token[:10] + "..." + token[len(token)-10:]
}

// ToDeviceView hides the raw token.
func (t PushToken) ToDeviceView() DeviceView {
	lastSeen := t.UpdatedAt
	if lastSeen.IsZero() {
		lastSeen = t.CreatedAt
	}
	return DeviceView{
		ID:          t.ID,
		DeviceType:  t.DeviceType,
		MaskedToken: MaskPushToken(t.Token),
		LastSeenAt:  lastSeen.UTC(),
		CreatedAt:   t.CreatedAt.UTC(),
	}
}
