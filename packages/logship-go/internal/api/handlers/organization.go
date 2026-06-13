package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/services"
)

type OrganizationHandler struct {
	orgService *services.OrganizationService
}

func NewOrganizationHandler(orgService *services.OrganizationService) *OrganizationHandler {
	return &OrganizationHandler{
		orgService: orgService,
	}
}

// GetMyOrganization returns the current user's organization
// GET /v1/organizations/me
func (h *OrganizationHandler) GetMyOrganization(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	org, err := h.orgService.GetUserOrganization(c.Request.Context(), userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get organization"})
		return
	}

	c.JSON(http.StatusOK, org)
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

// UpdateOrganizationRequest is the request body for updating an organization
type UpdateOrganizationRequest struct {
	Name string `json:"name" binding:"required,min=1,max=255"`
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
