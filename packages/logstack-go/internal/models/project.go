package models

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	OwnerID   uint      `gorm:"index;not null" json:"ownerId"`
	OrganizationID *uuid.UUID `gorm:"type:uuid;index" json:"organizationId"`
	APIKey    string    `gorm:"uniqueIndex;size:100;not null" json:"-"`
	Environment string   `gorm:"size:20;not null;default:'production'" json:"environment"`
	ArchivedAt *time.Time `gorm:"index" json:"archivedAt,omitempty"`
	CreatedAt time.Time `json:"createdAt"`

	// Relations
	Owner        User          `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Organization *Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	Logs         []Log         `gorm:"foreignKey:ProjectID" json:"logs,omitempty"`
	AlertRules []AlertRule `gorm:"foreignKey:ProjectID" json:"alertRules,omitempty"`
}

func GenerateAPIKey() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "ls_" + hex.EncodeToString(bytes), nil
}

type ProjectResponse struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	OwnerID     uint       `json:"ownerId"`
	Environment string     `json:"environment"`
	ArchivedAt  *time.Time `json:"archivedAt,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

type ProjectWithAPIKeyResponse struct {
	ProjectResponse
	APIKey string `json:"apiKey"`
}

func (p *Project) ToResponse() ProjectResponse {
	return ProjectResponse{
		ID:          p.ID,
		Name:        p.Name,
		OwnerID:     p.OwnerID,
		Environment: p.Environment,
		ArchivedAt:  p.ArchivedAt,
		CreatedAt:   p.CreatedAt,
	}
}

func (p *Project) ToResponseWithAPIKey() ProjectWithAPIKeyResponse {
	return ProjectWithAPIKeyResponse{
		ProjectResponse: p.ToResponse(),
		APIKey:          p.APIKey,
	}
}
