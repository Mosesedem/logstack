package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

var (
	ErrOrganizationNotFound = errors.New("organization not found")
	ErrMemberNotFound       = errors.New("member not found")
	ErrInsufficientPermissions = errors.New("insufficient permissions")
	ErrMemberLimitExceeded  = errors.New("member limit exceeded for plan")
	ErrAlreadyMember        = errors.New("user is already a member")
)

type OrganizationService struct {
	db           *gorm.DB
	auditService *AuditService
}

func NewOrganizationService(db *gorm.DB, auditService *AuditService) *OrganizationService {
	return &OrganizationService{
		db:           db,
		auditService: auditService,
	}
}

// GetUserOrganization returns the primary organization for a user
func (s *OrganizationService) GetUserOrganization(ctx context.Context, userID uint) (*models.Organization, error) {
	var membership models.OrganizationMember
	err := s.db.WithContext(ctx).
		Preload("Organization").
		Where("user_id = ?", userID).
		First(&membership).Error
	
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrganizationNotFound
		}
		return nil, fmt.Errorf("failed to get user organization: %w", err)
	}

	return &membership.Organization, nil
}

// GetOrganizationMembers returns all members of an organization
func (s *OrganizationService) GetOrganizationMembers(ctx context.Context, orgID uuid.UUID) ([]models.OrganizationMember, error) {
	var members []models.OrganizationMember
	err := s.db.WithContext(ctx).
		Preload("User").
		Where("organization_id = ?", orgID).
		Order("created_at ASC").
		Find(&members).Error
	
	if err != nil {
		return nil, fmt.Errorf("failed to get organization members: %w", err)
	}

	return members, nil
}

// GetMemberRole returns the role of a user in an organization
func (s *OrganizationService) GetMemberRole(ctx context.Context, orgID uuid.UUID, userID uint) (string, error) {
	var membership models.OrganizationMember
	err := s.db.WithContext(ctx).
		Where("organization_id = ? AND user_id = ?", orgID, userID).
		First(&membership).Error
	
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrMemberNotFound
		}
		return "", fmt.Errorf("failed to get member role: %w", err)
	}

	return membership.Role, nil
}

// CanManageMembers checks if a user can manage members (owner or admin)
func (s *OrganizationService) CanManageMembers(ctx context.Context, orgID uuid.UUID, userID uint) (bool, error) {
	role, err := s.GetMemberRole(ctx, orgID, userID)
	if err != nil {
		return false, err
	}
	return role == "owner" || role == "admin", nil
}

// GetMemberLimit returns the member limit for a subscription tier
func (s *OrganizationService) GetMemberLimit(tier models.SubscriptionTier) int {
	switch tier {
	case models.TierFree:
		return 1
	case models.TierStarter:
		return 3
	case models.TierPro:
		return 10
	case models.TierEnterprise:
		return -1 // Unlimited
	default:
		return 1
	}
}

// InviteMemberRequest contains data for inviting a member
type InviteMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required,oneof=admin member viewer"`
}

// InviteMember invites a user to an organization
func (s *OrganizationService) InviteMember(ctx context.Context, orgID uuid.UUID, inviterID uint, email string, role string) (*models.OrganizationMember, error) {
	// Verify inviter has permission
	canManage, err := s.CanManageMembers(ctx, orgID, inviterID)
	if err != nil {
		return nil, err
	}
	if !canManage {
		return nil, ErrInsufficientPermissions
	}

	// Find user by email
	var invitedUser models.User
	err = s.db.WithContext(ctx).Where("email = ?", strings.ToLower(email)).First(&invitedUser).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found with that email")
		}
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	// Check if already a member
	var existingMember models.OrganizationMember
	err = s.db.WithContext(ctx).
		Where("organization_id = ? AND user_id = ?", orgID, invitedUser.ID).
		First(&existingMember).Error
	
	if err == nil {
		return nil, ErrAlreadyMember
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check existing membership: %w", err)
	}

	// Get organization subscription to check limits
	var subscription models.Subscription
	err = s.db.WithContext(ctx).
		Joins("JOIN organization_members om ON om.user_id = subscriptions.user_id").
		Where("om.organization_id = ? AND om.role = 'owner'", orgID).
		First(&subscription).Error
	
	if err != nil {
		return nil, fmt.Errorf("failed to get organization subscription: %w", err)
	}

	// Check member limit
	limit := s.GetMemberLimit(subscription.Tier)
	if limit > 0 {
		var currentCount int64
		s.db.WithContext(ctx).Model(&models.OrganizationMember{}).
			Where("organization_id = ?", orgID).
			Count(&currentCount)
		
		if int(currentCount) >= limit {
			return nil, ErrMemberLimitExceeded
		}
	}

	// Create membership
	member := &models.OrganizationMember{
		OrganizationID: orgID,
		UserID:         invitedUser.ID,
		Role:           role,
	}

	err = s.db.WithContext(ctx).Create(member).Error
	if err != nil {
		return nil, fmt.Errorf("failed to create member: %w", err)
	}

	// Preload user data
	err = s.db.WithContext(ctx).Preload("User").First(member, member.ID).Error
	if err != nil {
		return nil, fmt.Errorf("failed to load member: %w", err)
	}

	// Log audit trail
	if s.auditService != nil {
		s.auditService.Log(ctx, AuditLogOptions{
			OrganizationID: orgID,
			UserID:         inviterID,
			Action:         models.AuditActionMemberInvited,
			ResourceType:   "member",
			ResourceID:     member.ID.String(),
			Details: models.AuditLogDetails{
				"invited_user_id":    invitedUser.ID,
				"invited_user_email": invitedUser.Email,
				"invited_user_name":  invitedUser.Name,
				"role":               role,
			},
		})
	}

	return member, nil
}

// UpdateMemberRole updates a member's role
func (s *OrganizationService) UpdateMemberRole(ctx context.Context, orgID uuid.UUID, updaterID uint, memberID uuid.UUID, newRole string) error {
	// Verify updater has permission
	canManage, err := s.CanManageMembers(ctx, orgID, updaterID)
	if err != nil {
		return err
	}
	if !canManage {
		return ErrInsufficientPermissions
	}

	// Cannot change owner role
	var member models.OrganizationMember
	err = s.db.WithContext(ctx).Where("id = ? AND organization_id = ?", memberID, orgID).First(&member).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrMemberNotFound
		}
		return fmt.Errorf("failed to find member: %w", err)
	}

	if member.Role == "owner" {
		return errors.New("cannot change owner role")
	}

	// Update role
	oldRole := member.Role
	err = s.db.WithContext(ctx).Model(&member).Update("role", newRole).Error
	if err != nil {
		return fmt.Errorf("failed to update role: %w", err)
	}

	// Log audit trail
	if s.auditService != nil {
		s.auditService.Log(ctx, AuditLogOptions{
			OrganizationID: orgID,
			UserID:         updaterID,
			Action:         models.AuditActionMemberRoleChanged,
			ResourceType:   "member",
			ResourceID:     memberID.String(),
			Details: models.AuditLogDetails{
				"member_user_id": member.UserID,
				"old_role":       oldRole,
				"new_role":       newRole,
			},
		})
	}

	return nil
}

// RemoveMember removes a member from an organization
func (s *OrganizationService) RemoveMember(ctx context.Context, orgID uuid.UUID, removerID uint, memberID uuid.UUID) error {
	// Verify remover has permission
	canManage, err := s.CanManageMembers(ctx, orgID, removerID)
	if err != nil {
		return err
	}
	if !canManage {
		return ErrInsufficientPermissions
	}

	// Cannot remove owner
	var member models.OrganizationMember
	err = s.db.WithContext(ctx).Where("id = ? AND organization_id = ?", memberID, orgID).First(&member).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrMemberNotFound
		}
		return fmt.Errorf("failed to find member: %w", err)
	}

	if member.Role == "owner" {
		return errors.New("cannot remove owner")
	}

	// Remove member
	err = s.db.WithContext(ctx).Delete(&member).Error
	if err != nil {
		return fmt.Errorf("failed to remove member: %w", err)
	}
	// Log audit trail
	if s.auditService != nil {
		s.auditService.Log(ctx, AuditLogOptions{
			OrganizationID: orgID,
			UserID:         removerID,
			Action:         models.AuditActionMemberRemoved,
			ResourceType:   "member",
			ResourceID:     memberID.String(),
			Details: models.AuditLogDetails{
				"removed_user_id": member.UserID,
				"role":            member.Role,
			},
		})
	}
	return nil
}

// GetOrgInvites returns all invites (pending and accepted) for an organization.
// The caller must be an owner or admin of the org.
func (s *OrganizationService) GetOrgInvites(ctx context.Context, orgID uuid.UUID, callerID uint) ([]models.Invite, error) {
	canManage, err := s.CanManageMembers(ctx, orgID, callerID)
	if err != nil {
		return nil, err
	}
	if !canManage {
		return nil, ErrInsufficientPermissions
	}

	var invites []models.Invite
	err = s.db.WithContext(ctx).
		Where("organization_id = ?", orgID).
		Order("created_at DESC").
		Find(&invites).Error
	if err != nil {
		return nil, fmt.Errorf("failed to get invites: %w", err)
	}

	return invites, nil
}

// UpdateOrganization updates organization details
func (s *OrganizationService) UpdateOrganization(ctx context.Context, orgID uuid.UUID, userID uint, name string) error {
	// Verify user is owner or admin
	canManage, err := s.CanManageMembers(ctx, orgID, userID)
	if err != nil {
		return err
	}
	if !canManage {
		return ErrInsufficientPermissions
	}

	var org models.Organization
	err = s.db.WithContext(ctx).Where("id = ?", orgID).First(&org).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrOrganizationNotFound
		}
		return fmt.Errorf("failed to find organization: %w", err)
	}

	err = s.db.WithContext(ctx).Model(&org).Update("name", name).Error
	if err != nil {
		return fmt.Errorf("failed to update organization: %w", err)
	}

	return nil
}
