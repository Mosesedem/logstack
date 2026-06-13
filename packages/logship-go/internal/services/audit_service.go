package services

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// AuditService handles audit log operations
type AuditService struct {
	db *gorm.DB
}

// NewAuditService creates a new audit service
func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

// AuditLogOptions contains options for creating an audit log
type AuditLogOptions struct {
	OrganizationID uuid.UUID
	UserID         uint
	Action         string
	ResourceType   string
	ResourceID     string
	Details        models.AuditLogDetails
	IPAddress      string
	UserAgent      string
}

// Log creates a new audit log entry
func (s *AuditService) Log(ctx context.Context, opts AuditLogOptions) error {
	auditLog := models.AuditLog{
		OrganizationID: opts.OrganizationID,
		UserID:         opts.UserID,
		Action:         opts.Action,
		ResourceType:   opts.ResourceType,
		ResourceID:     opts.ResourceID,
		Details:        opts.Details,
		IPAddress:      opts.IPAddress,
		UserAgent:      opts.UserAgent,
		CreatedAt:      time.Now(),
	}

	return s.db.WithContext(ctx).Create(&auditLog).Error
}

// GetOrganizationAuditLogs retrieves audit logs for an organization
func (s *AuditService) GetOrganizationAuditLogs(ctx context.Context, organizationID uuid.UUID, limit, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := s.db.WithContext(ctx).
		Preload("User").
		Where("organization_id = ?", organizationID)

	// Get total count
	if err := query.Model(&models.AuditLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated logs
	if err := query.
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// GetAuditLogsByAction retrieves audit logs filtered by action
func (s *AuditService) GetAuditLogsByAction(ctx context.Context, organizationID uuid.UUID, action string, limit, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := s.db.WithContext(ctx).
		Preload("User").
		Where("organization_id = ? AND action = ?", organizationID, action)

	// Get total count
	if err := query.Model(&models.AuditLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated logs
	if err := query.
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// GetAuditLogsByResource retrieves audit logs for a specific resource
func (s *AuditService) GetAuditLogsByResource(ctx context.Context, organizationID uuid.UUID, resourceType, resourceID string, limit, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := s.db.WithContext(ctx).
		Preload("User").
		Where("organization_id = ? AND resource_type = ? AND resource_id = ?", organizationID, resourceType, resourceID)

	// Get total count
	if err := query.Model(&models.AuditLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated logs
	if err := query.
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// GetUserAuditLogs retrieves audit logs for a specific user
func (s *AuditService) GetUserAuditLogs(ctx context.Context, organizationID uuid.UUID, userID uint, limit, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := s.db.WithContext(ctx).
		Preload("User").
		Where("organization_id = ? AND user_id = ?", organizationID, userID)

	// Get total count
	if err := query.Model(&models.AuditLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated logs
	if err := query.
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// DeleteOldAuditLogs deletes audit logs older than the specified duration
// This can be run periodically to manage database size
func (s *AuditService) DeleteOldAuditLogs(ctx context.Context, olderThan time.Duration) (int64, error) {
	cutoffTime := time.Now().Add(-olderThan)

	result := s.db.WithContext(ctx).
		Where("created_at < ?", cutoffTime).
		Delete(&models.AuditLog{})

	return result.RowsAffected, result.Error
}
