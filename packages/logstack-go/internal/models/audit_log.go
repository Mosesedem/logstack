package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AuditLog represents an audit trail entry for tracking organization actions
type AuditLog struct {
	ID             uuid.UUID       `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	OrganizationID uuid.UUID       `json:"organization_id" gorm:"type:uuid;not null;index"`
	UserID         uint            `json:"user_id" gorm:"not null;index"`
	Action         string          `json:"action" gorm:"size:100;not null;index"`
	ResourceType   string          `json:"resource_type" gorm:"size:50;not null;index:idx_audit_logs_resource"`
	ResourceID     string          `json:"resource_id,omitempty" gorm:"size:255;index:idx_audit_logs_resource"`
	Details        AuditLogDetails `json:"details,omitempty" gorm:"type:jsonb"`
	IPAddress      string          `json:"ip_address,omitempty" gorm:"size:45"`
	UserAgent      string          `json:"user_agent,omitempty"`
	CreatedAt      time.Time       `json:"created_at" gorm:"index:,sort:desc"`

	// Relationships
	Organization Organization `json:"-" gorm:"foreignKey:OrganizationID;constraint:OnDelete:CASCADE"`
	User         User         `json:"user,omitempty" gorm:"foreignKey:UserID;constraint:OnDelete:RESTRICT"`
}

// AuditLogDetails is a flexible JSON field for storing action-specific details
type AuditLogDetails map[string]interface{}

// Value implements the driver.Valuer interface for JSONB storage
func (d AuditLogDetails) Value() (driver.Value, error) {
	if d == nil {
		return nil, nil
	}
	return json.Marshal(d)
}

// Scan implements the sql.Scanner interface for JSONB retrieval
func (d *AuditLogDetails) Scan(value interface{}) error {
	if value == nil {
		*d = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}

	return json.Unmarshal(bytes, d)
}

// Common audit actions
const (
	// Member actions
	AuditActionMemberInvited     = "member.invited"
	AuditActionMemberRemoved     = "member.removed"
	AuditActionMemberRoleChanged = "member.role_changed"
	AuditActionMemberJoined      = "member.joined"

	// Project actions
	AuditActionProjectCreated = "project.created"
	AuditActionProjectUpdated = "project.updated"
	AuditActionProjectDeleted = "project.deleted"
	AuditActionProjectShared  = "project.shared"

	// Subscription actions
	AuditActionSubscriptionUpgraded   = "subscription.upgraded"
	AuditActionSubscriptionDowngraded = "subscription.downgraded"
	AuditActionSubscriptionCancelled  = "subscription.cancelled"
	AuditActionSubscriptionRenewed    = "subscription.renewed"

	// API Key actions
	AuditActionAPIKeyCreated = "api_key.created"
	AuditActionAPIKeyRevoked = "api_key.revoked"
	AuditActionAPIKeyUpdated = "api_key.updated"

	// Settings actions
	AuditActionSettingsUpdated = "settings.updated"
)

// AuditLogResponse is the API response format for audit logs
type AuditLogResponse struct {
	ID           uuid.UUID       `json:"id"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id,omitempty"`
	Details      AuditLogDetails `json:"details,omitempty"`
	User         *UserBasicInfo  `json:"user,omitempty"`
	IPAddress    string          `json:"ip_address,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

// UserBasicInfo provides basic user information for audit logs
type UserBasicInfo struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// ToResponse converts an AuditLog to AuditLogResponse
func (a *AuditLog) ToResponse() AuditLogResponse {
	response := AuditLogResponse{
		ID:           a.ID,
		Action:       a.Action,
		ResourceType: a.ResourceType,
		ResourceID:   a.ResourceID,
		Details:      a.Details,
		IPAddress:    a.IPAddress,
		CreatedAt:    a.CreatedAt,
	}

	if a.User.ID != 0 {
		response.User = &UserBasicInfo{
			ID:    a.User.ID,
			Name:  a.User.Name,
			Email: a.User.Email,
		}
	}

	return response
}
