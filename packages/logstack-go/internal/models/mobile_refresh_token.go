package models

import (
	"time"

	"github.com/google/uuid"
)

// MobileRefreshToken stores a non-expiring refresh token for mobile clients.
// Tokens are only invalidated by explicit logout or account block.
type MobileRefreshToken struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     uint      `gorm:"not null;index" json:"userId"`
	Token      string    `gorm:"size:512;uniqueIndex;not null" json:"token"`
	DeviceInfo string    `gorm:"type:text" json:"deviceInfo,omitempty"`
	Revoked    bool      `gorm:"default:false;not null" json:"revoked"`
	CreatedAt  time.Time `json:"createdAt"`

	// Relations
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
