package handlers

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AlertsHandler struct {
	alertEngine *services.AlertEngine
	db          *gorm.DB
}

func NewAlertsHandler(alertEngine *services.AlertEngine, db *gorm.DB) *AlertsHandler {
	return &AlertsHandler{
		alertEngine: alertEngine,
		db:          db,
	}
}

// verifyProjectAccess checks if the user has access to the project
func (h *AlertsHandler) verifyProjectAccess(c *gin.Context, projectIDStr string) (*models.Project, error) {
	userID := c.MustGet("userID").(uint)
	
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		return nil, err
	}

	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		return nil, err
	}

	return &project, nil
}

// List handles GET /v1/alerts
func (h *AlertsHandler) List(c *gin.Context) {
	projectIDStr := c.Query("projectId")
	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_PROJECT_ID",
			Message: "projectId query parameter is required",
		})
		return
	}

	// Verify user has access to the project
	if _, err := h.verifyProjectAccess(c, projectIDStr); err != nil {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    "FORBIDDEN",
			Message: "You do not have access to this project",
		})
		return
	}

	rules, err := h.alertEngine.GetRulesForProject(c.Request.Context(), projectIDStr)
	if err != nil {
		slog.Error("Failed to get alert rules", "error", err, "projectId", projectIDStr)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to fetch alert rules",
		})
		return
	}

	c.JSON(http.StatusOK, rules)
}

// Create handles POST /v1/alerts
func (h *AlertsHandler) Create(c *gin.Context) {
	projectIDStr := c.Query("projectId")
	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_PROJECT_ID",
			Message: "projectId query parameter is required",
		})
		return
	}

	// Verify user has access to the project
	project, err := h.verifyProjectAccess(c, projectIDStr)
	if err != nil {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    "FORBIDDEN",
			Message: "You do not have access to this project",
		})
		return
	}

	var req models.AlertRuleCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	channels := req.Channels
	if len(channels) == 0 && req.Channel != "" {
		channels = []string{string(req.Channel)}
	}
	if len(channels) == 0 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "At least one notification channel is required",
		})
		return
	}

	recipient := strings.TrimSpace(req.Recipient)
	if recipient == "" {
		for _, ch := range channels {
			if ch == string(models.AlertChannelEmail) || ch == string(models.AlertChannelWebhook) {
				c.JSON(http.StatusBadRequest, ErrorResponse{
					Code:    "VALIDATION_ERROR",
					Message: "recipient is required for email and webhook channels",
				})
				return
			}
		}
		userID := c.MustGet("userID").(uint)
		var user models.User
		if err := h.db.Select("email").First(&user, userID).Error; err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Code:    "VALIDATION_ERROR",
				Message: "recipient is required",
			})
			return
		}
		recipient = user.Email
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	cooldownMinutes := req.CooldownMinutes
	if cooldownMinutes <= 0 {
		cooldownMinutes = 15
	}

	rule := models.AlertRule{
		ProjectID:       project.ID,
		Name:            req.Name,
		TriggerPattern:  req.TriggerPattern,
		TriggerLevel:    req.TriggerLevel,
		Channel:         models.AlertChannel(channels[0]),
		Recipient:       recipient,
		CooldownMinutes: cooldownMinutes,
		Enabled:         enabled,
		Channels:        datatypes.JSONSlice[string](channels),
	}

	// Set multi-value fields from request
	if len(req.TriggerPatterns) > 0 {
		rule.TriggerPatterns = datatypes.JSONSlice[string](req.TriggerPatterns)
		if rule.TriggerPattern == "" {
			rule.TriggerPattern = req.TriggerPatterns[0]
		}
	}

	if err := h.alertEngine.CreateRule(c.Request.Context(), &rule); err != nil {
		slog.Error("Failed to create alert rule", "error", err, "projectId", project.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to create alert rule",
		})
		return
	}

	slog.Info("Alert rule created", "ruleId", rule.ID, "projectId", project.ID)
	c.JSON(http.StatusCreated, rule)
}

// Get handles GET /v1/alerts/:id
func (h *AlertsHandler) Get(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid alert rule ID",
		})
		return
	}

	rule, err := h.alertEngine.GetRule(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Alert rule not found",
		})
		return
	}

	// Verify user has access to the project
	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", rule.ProjectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    "FORBIDDEN",
			Message: "You do not have access to this alert rule",
		})
		return
	}

	c.JSON(http.StatusOK, rule)
}

// Update handles PUT /v1/alerts/:id
func (h *AlertsHandler) Update(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid alert rule ID",
		})
		return
	}

	rule, err := h.alertEngine.GetRule(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Alert rule not found",
		})
		return
	}

	// Verify user has access to the project
	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", rule.ProjectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    "FORBIDDEN",
			Message: "You do not have access to this alert rule",
		})
		return
	}

	var req models.AlertRuleUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Apply updates
	if req.Name != nil {
		rule.Name = *req.Name
	}
	if req.TriggerPattern != nil {
		rule.TriggerPattern = *req.TriggerPattern
	}
	if req.TriggerLevel != nil {
		rule.TriggerLevel = *req.TriggerLevel
	}
	if req.Channel != nil {
		rule.Channel = *req.Channel
	}
	if req.Recipient != nil {
		rule.Recipient = *req.Recipient
	}
	if req.CooldownMinutes != nil {
		rule.CooldownMinutes = *req.CooldownMinutes
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}
	if len(req.TriggerPatterns) > 0 {
		rule.TriggerPatterns = datatypes.JSONSlice[string](req.TriggerPatterns)
	}
	if len(req.Channels) > 0 {
		rule.Channels = datatypes.JSONSlice[string](req.Channels)
	}

	if err := h.alertEngine.UpdateRule(c.Request.Context(), rule); err != nil {
		slog.Error("Failed to update alert rule", "error", err, "ruleId", rule.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to update alert rule",
		})
		return
	}

	slog.Info("Alert rule updated", "ruleId", rule.ID)
	c.JSON(http.StatusOK, rule)
}

// Delete handles DELETE /v1/alerts/:id
func (h *AlertsHandler) Delete(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid alert rule ID",
		})
		return
	}

	rule, err := h.alertEngine.GetRule(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Alert rule not found",
		})
		return
	}

	// Verify user has access to the project
	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", rule.ProjectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    "FORBIDDEN",
			Message: "You do not have access to this alert rule",
		})
		return
	}

	if err := h.alertEngine.DeleteRule(c.Request.Context(), uint(id)); err != nil {
		slog.Error("Failed to delete alert rule", "error", err, "ruleId", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to delete alert rule",
		})
		return
	}

	slog.Info("Alert rule deleted", "ruleId", id)
	c.JSON(http.StatusOK, gin.H{"message": "Alert rule deleted successfully"})
}

// GetOptions handles GET /v1/alerts/options
func (h *AlertsHandler) GetOptions(c *gin.Context) {
	c.JSON(http.StatusOK, models.AlertOptionsResponse{
		Channels:        []string{"email", "push", "webhook"},
		TriggerPatterns: []string{".*error.*", ".*exception.*", ".*fatal.*", ".*critical.*", ".*timeout.*", ".*panic.*"},
		TriggerLevels:   []string{"debug", "info", "warn", "error", "critical", "fatal"},
		CooldownOptions: []int{5, 10, 15, 30, 60},
	})
}

// GetHistory handles GET /v1/alerts/:id/history
func (h *AlertsHandler) GetHistory(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid alert rule ID",
		})
		return
	}

	rule, err := h.alertEngine.GetRule(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Alert rule not found",
		})
		return
	}

	// Verify user has access to the project
	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", rule.ProjectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    "FORBIDDEN",
			Message: "You do not have access to this alert rule",
		})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit > 100 {
		limit = 100
	}
	if limit < 1 {
		limit = 1
	}

	history, err := h.alertEngine.GetAlertHistory(c.Request.Context(), uint(id), limit)
	if err != nil {
		slog.Error("Failed to get alert history", "error", err, "ruleId", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to fetch alert history",
		})
		return
	}

	c.JSON(http.StatusOK, history)
}

// SendTestEmail handles POST /v1/alerts/:id/test-email
func (h *AlertsHandler) SendTestEmail(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid alert rule ID",
		})
		return
	}

	rule, err := h.alertEngine.GetRule(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Alert rule not found",
		})
		return
	}

	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", rule.ProjectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusForbidden, ErrorResponse{
			Code:    "FORBIDDEN",
			Message: "You do not have access to this alert rule",
		})
		return
	}

	if err := h.alertEngine.SendTestNotification(c.Request.Context(), uint(id)); err != nil {
		slog.Error("Failed to send test alert email", "error", err, "ruleId", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "DELIVERY_FAILED",
			Message: err.Error(),
		})
		return
	}

	slog.Info("Test alert email sent", "ruleId", id, "recipient", rule.Recipient)
	c.JSON(http.StatusOK, gin.H{
		"message":   "Test alert email sent",
		"recipient": rule.Recipient,
	})
}
