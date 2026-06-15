package models

import (
	"time"

	"github.com/google/uuid"
)

type Organization struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	Slug      string    `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// Relations
	Members       []OrganizationMember `gorm:"foreignKey:OrganizationID" json:"members,omitempty"`
	Projects      []Project            `gorm:"foreignKey:OrganizationID" json:"projects,omitempty"`
	Subscriptions []Subscription       `gorm:"foreignKey:OrganizationID" json:"subscriptions,omitempty"`
}

type OrganizationMember struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	OrganizationID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_org_user" json:"organizationId"`
	UserID         uint      `gorm:"not null;uniqueIndex:idx_org_user" json:"userId"`
	Role           string    `gorm:"size:50;not null;default:'member'" json:"role"` // owner, admin, member, viewer
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`

	// Relations
	Organization Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	User         User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
