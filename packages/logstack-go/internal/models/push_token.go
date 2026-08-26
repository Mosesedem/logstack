package models

import (
	"strconv"
	"time"

	"github.com/google/uuid"
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
	SessionID  *uuid.UUID `gorm:"type:uuid;index" json:"sessionId,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type PushTokenCreateRequest struct {
	Token      string     `json:"token" binding:"required"`
	DeviceType DeviceType `json:"deviceType" binding:"required"`
}

const (
	DeviceIDPrefixSession = "session:"
	DeviceIDPrefixPush    = "push:"
)

// DeviceView is the dashboard-safe shape of a linked mobile device.
type DeviceView struct {
	ID          string     `json:"id"`
	DeviceType  DeviceType `json:"deviceType,omitempty"`
	MaskedToken string     `json:"maskedToken,omitempty"`
	LastSeenAt  time.Time  `json:"lastSeenAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	SignedIn    bool       `json:"signedIn"`
	PushEnabled bool       `json:"pushEnabled"`
}

// MaskPushToken redacts an FCM token for logs and the dashboard.
func MaskPushToken(token string) string {
	if len(token) <= 20 {
		return "***"
	}
	return token[:10] + "..." + token[len(token)-10:]
}

// ToDeviceView hides the raw token. Used for push rows with no linked session.
func (t PushToken) ToDeviceView() DeviceView {
	lastSeen := t.UpdatedAt
	if lastSeen.IsZero() {
		lastSeen = t.CreatedAt
	}
	return DeviceView{
		ID:          DeviceIDPrefixPush + strconv.FormatUint(uint64(t.ID), 10),
		DeviceType:  t.DeviceType,
		MaskedToken: MaskPushToken(t.Token),
		LastSeenAt:  lastSeen.UTC(),
		CreatedAt:   t.CreatedAt.UTC(),
		SignedIn:    false,
		PushEnabled: true,
	}
}
