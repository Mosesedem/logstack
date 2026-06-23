package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"github.com/mosesedem/logstack/internal/services/notification"
	"gorm.io/gorm"
)

type OrganizationHandler struct {
	orgService    *services.OrganizationService
	db            *gorm.DB
	emailNotifier *notification.EmailNotifier
}

func NewOrganizationHandler(orgService *services.OrganizationService, db *gorm.DB, emailNotifier *notification.EmailNotifier) *OrganizationHandler {
	return &OrganizationHandler{
		orgService:    orgService,
		db:            db,
		emailNotifier: emailNotifier,
	}
}

// OrgMeResponse is the response shape for GET /v1/organizations/me.
// It embeds the Organization fields and adds the caller's membership role.
type OrgMeResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt string    `json:"createdAt"`
	UpdatedAt string    `json:"updatedAt"`
	Role      string    `json:"role"` // caller's membership role: owner|admin|member|viewer
}

// GetMyOrganization returns the current user's organization and their role.
// GET /v1/organizations/me
func (h *OrganizationHandler) GetMyOrganization(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	uid := userID.(uint)

	org, err := h.orgService.GetUserOrganization(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get organization"})
		return
	}

	role, err := h.orgService.GetMemberRole(c.Request.Context(), org.ID, uid)
	if err != nil {
		// Fall back to returning org without role rather than failing entirely
		role = ""
	}

	c.JSON(http.StatusOK, OrgMeResponse{
		ID:        org.ID,
		Name:      org.Name,
		Slug:      org.Slug,
		CreatedAt: org.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: org.UpdatedAt.UTC().Format(time.RFC3339),
		Role:      role,
	})
}

// GetMembers returns all members of the organization
// GET /v1/organizations/:id/members
func (h *OrganizationHandler) GetMembers(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// Verify user is member of org
	_, err = h.orgService.GetMemberRole(c.Request.Context(), orgID, userID.(uint))
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this organization"})
		return
	}

	members, err := h.orgService.GetOrganizationMembers(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get members"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

// InviteMemberRequest is the request body for inviting a member
type InviteMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required,oneof=admin member viewer"`
}

// InviteMember invites a user to the organization
// POST /v1/organizations/:id/members
func (h *OrganizationHandler) InviteMember(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	var req InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	member, err := h.orgService.InviteMember(c.Request.Context(), orgID, userID.(uint), req.Email, req.Role)
	if err != nil {
		switch err {
		case services.ErrInsufficientPermissions:
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		case services.ErrMemberLimitExceeded:
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error": "member limit exceeded for your plan",
				"code":  "MEMBER_LIMIT_EXCEEDED",
			})
		case services.ErrAlreadyMember:
			c.JSON(http.StatusConflict, gin.H{"error": "user is already a member"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, member)
}

// UpdateMemberRoleRequest is the request body for updating a member's role
type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin member viewer"`
}

// UpdateMemberRole updates a member's role
// PATCH /v1/organizations/:id/members/:memberId
func (h *OrganizationHandler) UpdateMemberRole(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	memberIDStr := c.Param("memberId")
	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid member id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	var req UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.orgService.UpdateMemberRole(c.Request.Context(), orgID, userID.(uint), memberID, req.Role)
	if err != nil {
		switch err {
		case services.ErrInsufficientPermissions:
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		case services.ErrMemberNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role updated successfully"})
}

// RemoveMember removes a member from the organization
// DELETE /v1/organizations/:id/members/:memberId
func (h *OrganizationHandler) RemoveMember(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	memberIDStr := c.Param("memberId")
	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid member id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	err = h.orgService.RemoveMember(c.Request.Context(), orgID, userID.(uint), memberID)
	if err != nil {
		switch err {
		case services.ErrInsufficientPermissions:
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		case services.ErrMemberNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed successfully"})
}

// GetInvites returns all invites for an organization.
// Caller must be owner or admin.
// GET /v1/organizations/:id/invites
func (h *OrganizationHandler) GetInvites(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	invites, err := h.orgService.GetOrgInvites(c.Request.Context(), orgID, userID.(uint))
	if err != nil {
		switch err {
		case services.ErrInsufficientPermissions:
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		case services.ErrMemberNotFound:
			c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this organization"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get invites"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"invites": invites})
}

// UpdateOrganizationRequest is the request body for updating an organization
type UpdateOrganizationRequest struct {
	Name string `json:"name" binding:"required,min=1,max=255"`
}

// CreateInviteRequest is the request body for creating an invite
type CreateInviteRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required,oneof=admin member viewer"`
}

// CreateInvite creates an invite for a new organization member
// POST /v1/organizations/:id/invites
func (h *OrganizationHandler) CreateInvite(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// Verify caller is owner or admin
	canManage, err := h.orgService.CanManageMembers(c.Request.Context(), orgID, userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
		return
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "insufficient permissions",
			"code":  "INSUFFICIENT_ROLE",
		})
		return
	}

	var req CreateInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Fetch organization name for the email
	var org models.Organization
	if err := h.db.WithContext(c.Request.Context()).Where("id = ?", orgID).First(&org).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		return
	}

	// Generate secure 32-byte hex token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		slog.Error("Failed to generate invite token", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate invite token"})
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// Build invite record
	invite := models.Invite{
		OrganizationID: orgID,
		Email:          req.Email,
		Role:           req.Role,
		Token:          token,
		Status:         "pending",
		ExpiresAt:      time.Now().Add(48 * time.Hour),
	}

	if err := h.db.WithContext(c.Request.Context()).Create(&invite).Error; err != nil {
		slog.Error("Failed to create invite", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create invite"})
		return
	}

	// Send invite email (non-blocking)
	if h.emailNotifier != nil {
		frontendURL := os.Getenv("BASE_URL")
		if frontendURL == "" {
			frontendURL = "https://logstack.tech"
		}
		inviteURL := fmt.Sprintf("%s/accept-invite?token=%s", frontendURL, token)

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := h.emailNotifier.SendInviteEmail(ctx, req.Email, org.Name, req.Role, inviteURL); err != nil {
				slog.Error("Failed to send invite email", "error", err, "email", req.Email)
			} else {
				slog.Info("Invite email sent", "email", req.Email, "orgID", orgID)
			}
		}()
	}

	// Return 201 — token is omitted from response (json:"-" on the model field)
	c.JSON(http.StatusCreated, invite)
}

// UpdateOrganization updates organization details
// PATCH /v1/organizations/:id
func (h *OrganizationHandler) UpdateOrganization(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	var req UpdateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.orgService.UpdateOrganization(c.Request.Context(), orgID, userID.(uint), req.Name)
	if err != nil {
		switch err {
		case services.ErrInsufficientPermissions:
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		case services.ErrOrganizationNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "organization not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "organization updated successfully"})
}

// RevokeInvite deletes a pending invite by ID.
// Caller must be owner or admin. Returns 404 if the invite is not found,
// not pending, or does not belong to the organization.
// DELETE /v1/organizations/:id/invites/:inviteId
func (h *OrganizationHandler) RevokeInvite(c *gin.Context) {
	orgIDStr := c.Param("id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organization id"})
		return
	}

	inviteIDStr := c.Param("inviteId")
	inviteID, err := uuid.Parse(inviteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid invite id"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// Verify caller is owner or admin
	canManage, err := h.orgService.CanManageMembers(c.Request.Context(), orgID, userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
		return
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "insufficient permissions",
			"code":  "INSUFFICIENT_ROLE",
		})
		return
	}

	// Look up the invite — must be pending and belong to this org
	var invite models.Invite
	err = h.db.WithContext(c.Request.Context()).
		Where("id = ? AND organization_id = ? AND status = ?", inviteID, orgID, "pending").
		First(&invite).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invite not found"})
		return
	}

	// Delete the invite record
	if err := h.db.WithContext(c.Request.Context()).Delete(&invite).Error; err != nil {
		slog.Error("Failed to revoke invite", "error", err, "inviteID", inviteID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke invite"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invite revoked"})
}
