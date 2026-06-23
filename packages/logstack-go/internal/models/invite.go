package models

import (
	"time"

	"github.com/google/uuid"
)

type Invite struct {
	ID             uuid.UUID    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	OrganizationID uuid.UUID    `gorm:"type:uuid;not null" json:"organizationId"`
	Email          string       `gorm:"size:255;not null" json:"email"`
	Role           string       `gorm:"size:50;not null" json:"role"`
	Token          string       `gorm:"size:255;uniqueIndex;not null" json:"-"`
	Status         string       `gorm:"size:20;not null;default:'pending'" json:"status"`
	ExpiresAt      time.Time    `json:"expiresAt"`
	CreatedAt      time.Time    `json:"createdAt"`
	Organization   Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
}

// IsExpired reports whether the invite has passed its expiry time.
func (i *Invite) IsExpired() bool {
	return time.Now().After(i.ExpiresAt)
}
