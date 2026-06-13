package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
)

type AuditHandler struct {
	auditService        *services.AuditService
	organizationService *services.OrganizationService
}

func NewAuditHandler(auditService *services.AuditService, organizationService *services.OrganizationService) *AuditHandler {
	return &AuditHandler{
		auditService:        auditService,
		organizationService: organizationService,
	}
}

// GetAuditLogs godoc
// @Summary Get audit logs for organization
// @Description Get paginated audit logs for the user's organization
// @Tags audit
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(50)
// @Param action query string false "Filter by action"
// @Param user_id query int false "Filter by user ID"
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /v1/audit [get]
func (h *AuditHandler) GetAuditLogs(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	// Get user's organization
	org, err := h.organizationService.GetUserOrganization(c.Request.Context(), userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get organization"})
		return
	}

	// Parse pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage

	// Parse filters
	action := c.Query("action")
	userIDFilter := c.Query("user_id")

	var logs []models.AuditLog
	var total int64

	// Apply filters
	if action != "" {
		logs, total, err = h.auditService.GetAuditLogsByAction(c.Request.Context(), org.ID, action, perPage, offset)
	} else if userIDFilter != "" {
		uid, parseErr := strconv.ParseUint(userIDFilter, 10, 32)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
			return
		}
		logs, total, err = h.auditService.GetUserAuditLogs(c.Request.Context(), org.ID, uint(uid), perPage, offset)
	} else {
		logs, total, err = h.auditService.GetOrganizationAuditLogs(c.Request.Context(), org.ID, perPage, offset)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	// Convert to response format
	responses := make([]models.AuditLogResponse, len(logs))
	for i, log := range logs {
		responses[i] = log.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":       responses,
		"total":      total,
		"page":       page,
		"per_page":   perPage,
		"total_pages": (total + int64(perPage) - 1) / int64(perPage),
	})
}

// GetResourceAuditLogs godoc
// @Summary Get audit logs for a specific resource
// @Description Get paginated audit logs for a specific resource (e.g., member, project)
// @Tags audit
// @Accept json
// @Produce json
// @Param resource_type path string true "Resource type (member, project, etc.)"
// @Param resource_id path string true "Resource ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(50)
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /v1/audit/{resource_type}/{resource_id} [get]
func (h *AuditHandler) GetResourceAuditLogs(c *gin.Context) {
	userID, _ := c.Get("user_id")
	resourceType := c.Param("resource_type")
	resourceID := c.Param("resource_id")

	// Get user's organization
	org, err := h.organizationService.GetUserOrganization(c.Request.Context(), userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get organization"})
		return
	}

	// Parse pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 50
	}
	offset := (page - 1) * perPage

	logs, total, err := h.auditService.GetAuditLogsByResource(c.Request.Context(), org.ID, resourceType, resourceID, perPage, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	// Convert to response format
	responses := make([]models.AuditLogResponse, len(logs))
	for i, log := range logs {
		responses[i] = log.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":        responses,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": (total + int64(perPage) - 1) / int64(perPage),
	})
}

// GetAuditActions godoc
// @Summary Get available audit actions
// @Description Get a list of all possible audit actions for filtering
// @Tags audit
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Router /v1/audit/actions [get]
func (h *AuditHandler) GetAuditActions(c *gin.Context) {
	actions := []string{
		models.AuditActionMemberInvited,
		models.AuditActionMemberRemoved,
		models.AuditActionMemberRoleChanged,
		models.AuditActionMemberJoined,
		models.AuditActionProjectCreated,
		models.AuditActionProjectUpdated,
		models.AuditActionProjectDeleted,
		models.AuditActionProjectShared,
		models.AuditActionSubscriptionUpgraded,
		models.AuditActionSubscriptionDowngraded,
		models.AuditActionSubscriptionCancelled,
		models.AuditActionSubscriptionRenewed,
		models.AuditActionAPIKeyCreated,
		models.AuditActionAPIKeyRevoked,
		models.AuditActionAPIKeyUpdated,
		models.AuditActionSettingsUpdated,
	}

	c.JSON(http.StatusOK, gin.H{
		"actions": actions,
	})
}
