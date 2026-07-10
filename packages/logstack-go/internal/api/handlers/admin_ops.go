package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ---------- Organizations ----------

type adminCreateOrgRequest struct {
	Name string `json:"name" binding:"required,min=1,max=255"`
	Slug string `json:"slug" binding:"omitempty,min=1,max=255"`
}

type adminUpdateOrgRequest struct {
	Name *string `json:"name" binding:"omitempty,min=1,max=255"`
	Slug *string `json:"slug" binding:"omitempty,min=1,max=255"`
}

type adminCreateMemberRequest struct {
	UserID uint   `json:"userId" binding:"required"`
	Role   string `json:"role" binding:"required,oneof=owner admin member viewer"`
}

type adminUpdateMemberRequest struct {
	Role string `json:"role" binding:"required,oneof=owner admin member viewer"`
}

func (h *AdminHandler) ListOrganizations(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	search := strings.TrimSpace(c.Query("search"))

	query := h.db.Model(&models.Organization{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name ILIKE ? OR slug ILIKE ?", like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to count organizations"})
		return
	}
	var orgs []models.Organization
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&orgs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch organizations"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"organizations": orgs, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) GetOrganization(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}
	var org models.Organization
	if err := h.db.Preload("Members.User").First(&org, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Organization not found"})
		return
	}
	c.JSON(http.StatusOK, org)
}

func (h *AdminHandler) CreateOrganization(c *gin.Context) {
	var req adminCreateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	name := strings.TrimSpace(req.Name)
	slug := strings.TrimSpace(req.Slug)
	if slug == "" {
		slug = slugify(name)
	}
	org := models.Organization{Name: name, Slug: slug}
	if err := h.db.Create(&org).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, ErrorResponse{Code: "SLUG_EXISTS", Message: "Organization slug already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create organization"})
		return
	}
	c.JSON(http.StatusCreated, org)
}

func (h *AdminHandler) UpdateOrganization(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}
	var org models.Organization
	if err := h.db.First(&org, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Organization not found"})
		return
	}
	var req adminUpdateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if req.Name != nil {
		org.Name = strings.TrimSpace(*req.Name)
	}
	if req.Slug != nil {
		org.Slug = strings.TrimSpace(*req.Slug)
	}
	if err := h.db.Save(&org).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, ErrorResponse{Code: "SLUG_EXISTS", Message: "Organization slug already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update organization"})
		return
	}
	c.JSON(http.StatusOK, org)
}

func (h *AdminHandler) DeleteOrganization(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		var org models.Organization
		if err := tx.First(&org, "id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Where("organization_id = ?", id).Delete(&models.OrganizationMember{}).Error; err != nil {
			return err
		}
		if err := tx.Where("organization_id = ?", id).Delete(&models.Invite{}).Error; err != nil {
			return err
		}
		if err := tx.Where("organization_id = ?", id).Delete(&models.AuditLog{}).Error; err != nil {
			return err
		}
		// Detach projects rather than cascade-delete user data
		if err := tx.Model(&models.Project{}).Where("organization_id = ?", id).Update("organization_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Subscription{}).Where("organization_id = ?", id).Update("organization_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&models.Organization{}, "id = ?", id).Error
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Organization not found"})
			return
		}
		slog.Error("Admin delete organization failed", "error", err, "orgID", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete organization"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Organization deleted successfully"})
}

func (h *AdminHandler) ListOrgMembers(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}
	var members []models.OrganizationMember
	if err := h.db.Preload("User").Where("organization_id = ?", id).Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch members"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"members": members, "total": len(members)})
}

func (h *AdminHandler) CreateOrgMember(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}
	if err := h.db.First(&models.Organization{}, "id = ?", orgID).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Organization not found"})
		return
	}
	var req adminCreateMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if err := h.db.First(&models.User{}, req.UserID).Error; err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "USER_NOT_FOUND", Message: "User does not exist"})
		return
	}
	member := models.OrganizationMember{
		OrganizationID: orgID,
		UserID:         req.UserID,
		Role:           req.Role,
	}
	if err := h.db.Create(&member).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, ErrorResponse{Code: "MEMBER_EXISTS", Message: "User is already a member"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to add member"})
		return
	}
	c.JSON(http.StatusCreated, member)
}

func (h *AdminHandler) UpdateOrgMember(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}
	memberID, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid member id"})
		return
	}
	var req adminUpdateMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	var member models.OrganizationMember
	if err := h.db.Where("id = ? AND organization_id = ?", memberID, orgID).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Member not found"})
		return
	}
	member.Role = req.Role
	if err := h.db.Save(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update member"})
		return
	}
	c.JSON(http.StatusOK, member)
}

func (h *AdminHandler) DeleteOrgMember(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}
	memberID, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid member id"})
		return
	}
	result := h.db.Where("id = ? AND organization_id = ?", memberID, orgID).Delete(&models.OrganizationMember{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to remove member"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Member not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// ---------- Alerts ----------

type adminAlertBody struct {
	ProjectID       string   `json:"projectId" binding:"required"`
	Name            string   `json:"name" binding:"required,min=1,max=100"`
	TriggerPatterns []string `json:"triggerPatterns"`
	TriggerLevel    string   `json:"triggerLevel"`
	Channels        []string `json:"channels"`
	Recipient       string   `json:"recipient" binding:"required"`
	CooldownMinutes *int     `json:"cooldownMinutes"`
	Enabled         *bool    `json:"enabled"`
}

type adminAlertUpdateBody struct {
	Name            *string  `json:"name" binding:"omitempty,min=1,max=100"`
	TriggerPatterns []string `json:"triggerPatterns"`
	TriggerLevel    *string  `json:"triggerLevel"`
	Channels        []string `json:"channels"`
	Recipient       *string  `json:"recipient"`
	CooldownMinutes *int     `json:"cooldownMinutes"`
	Enabled         *bool    `json:"enabled"`
	ProjectID       *string  `json:"projectId"`
}

func (h *AdminHandler) ListAlerts(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	projectID := strings.TrimSpace(c.Query("projectId"))
	search := strings.TrimSpace(c.Query("search"))

	query := h.db.Model(&models.AlertRule{})
	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to count alerts"})
		return
	}
	var rows []models.AlertRule
	if err := query.Preload("Project").Order("created_at DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch alerts"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"alerts": rows, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) GetAlert(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid alert id"})
		return
	}
	var rule models.AlertRule
	if err := h.db.Preload("Project").First(&rule, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Alert not found"})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func (h *AdminHandler) CreateAlert(c *gin.Context) {
	var req adminAlertBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid project id"})
		return
	}
	if err := h.db.First(&models.Project{}, "id = ?", projectID).Error; err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "PROJECT_NOT_FOUND", Message: "Project does not exist"})
		return
	}
	cooldown := 15
	if req.CooldownMinutes != nil {
		cooldown = *req.CooldownMinutes
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	patterns := req.TriggerPatterns
	if patterns == nil {
		patterns = []string{}
	}
	channels := req.Channels
	if channels == nil {
		channels = []string{"email"}
	}
	rule := models.AlertRule{
		ProjectID:       projectID,
		Name:            strings.TrimSpace(req.Name),
		TriggerPatterns: datatypes.JSONSlice[string](patterns),
		TriggerLevel:    models.LogLevel(req.TriggerLevel),
		Channels:        datatypes.JSONSlice[string](channels),
		Recipient:       req.Recipient,
		CooldownMinutes: cooldown,
		Enabled:         enabled,
	}
	if err := h.db.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create alert"})
		return
	}
	c.JSON(http.StatusCreated, rule)
}

func (h *AdminHandler) UpdateAlert(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid alert id"})
		return
	}
	var rule models.AlertRule
	if err := h.db.First(&rule, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Alert not found"})
		return
	}
	var req adminAlertUpdateBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if req.Name != nil {
		rule.Name = strings.TrimSpace(*req.Name)
	}
	if req.TriggerPatterns != nil {
		rule.TriggerPatterns = datatypes.JSONSlice[string](req.TriggerPatterns)
	}
	if req.TriggerLevel != nil {
		rule.TriggerLevel = models.LogLevel(*req.TriggerLevel)
	}
	if req.Channels != nil {
		rule.Channels = datatypes.JSONSlice[string](req.Channels)
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
	if req.ProjectID != nil {
		pid, err := uuid.Parse(*req.ProjectID)
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid project id"})
			return
		}
		rule.ProjectID = pid
	}
	if err := h.db.Save(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update alert"})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func (h *AdminHandler) DeleteAlert(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid alert id"})
		return
	}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("alert_rule_id = ?", id).Delete(&models.AlertHistory{}).Error; err != nil {
			return err
		}
		result := tx.Delete(&models.AlertRule{}, id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Alert not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete alert"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Alert deleted successfully"})
}

// ---------- Invites ----------

type adminCreateInviteRequest struct {
	OrganizationID string `json:"organizationId" binding:"required"`
	Email          string `json:"email" binding:"required,email"`
	Role           string `json:"role" binding:"required,oneof=admin member viewer"`
	ExpiresInDays  *int   `json:"expiresInDays"`
	Status         string `json:"status" binding:"omitempty,oneof=pending accepted revoked expired"`
}

type adminUpdateInviteRequest struct {
	Email  *string `json:"email" binding:"omitempty,email"`
	Role   *string `json:"role" binding:"omitempty,oneof=admin member viewer"`
	Status *string `json:"status" binding:"omitempty,oneof=pending accepted revoked expired"`
}

func (h *AdminHandler) ListInvites(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	status := strings.TrimSpace(c.Query("status"))
	orgID := strings.TrimSpace(c.Query("organizationId"))

	query := h.db.Model(&models.Invite{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if orgID != "" {
		query = query.Where("organization_id = ?", orgID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to count invites"})
		return
	}
	var rows []models.Invite
	if err := query.Preload("Organization").Order("created_at DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch invites"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"invites": rows, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) CreateInvite(c *gin.Context) {
	var req adminCreateInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid organization id"})
		return
	}
	if err := h.db.First(&models.Organization{}, "id = ?", orgID).Error; err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "ORG_NOT_FOUND", Message: "Organization does not exist"})
		return
	}
	days := 7
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		days = *req.ExpiresInDays
	}
	token, err := randomToken(32)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create invite"})
		return
	}
	status := "pending"
	if req.Status != "" {
		status = req.Status
	}
	invite := models.Invite{
		OrganizationID: orgID,
		Email:          strings.ToLower(strings.TrimSpace(req.Email)),
		Role:           req.Role,
		Token:          token,
		Status:         status,
		ExpiresAt:      time.Now().UTC().Add(time.Duration(days) * 24 * time.Hour),
	}
	if err := h.db.Create(&invite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create invite"})
		return
	}
	c.JSON(http.StatusCreated, invite)
}

func (h *AdminHandler) UpdateInvite(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid invite id"})
		return
	}
	var invite models.Invite
	if err := h.db.First(&invite, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Invite not found"})
		return
	}
	var req adminUpdateInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if req.Email != nil {
		invite.Email = strings.ToLower(strings.TrimSpace(*req.Email))
	}
	if req.Role != nil {
		invite.Role = *req.Role
	}
	if req.Status != nil {
		invite.Status = *req.Status
	}
	if err := h.db.Save(&invite).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update invite"})
		return
	}
	c.JSON(http.StatusOK, invite)
}

func (h *AdminHandler) DeleteInvite(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid invite id"})
		return
	}
	result := h.db.Where("id = ?", id).Delete(&models.Invite{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete invite"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Invite not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Invite deleted successfully"})
}

// ---------- Usage ----------

type adminUsageUpdateBody struct {
	LogCount      *int64 `json:"logCount"`
	BytesIngested *int64 `json:"bytesIngested"`
}

func (h *AdminHandler) ListUsage(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	projectID := strings.TrimSpace(c.Query("projectId"))

	query := h.db.Model(&models.UsageLog{})
	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to count usage"})
		return
	}
	var rows []models.UsageLog
	if err := query.Preload("Project").Order("month DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch usage"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"usage": rows, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) UpdateUsage(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid usage id"})
		return
	}
	var row models.UsageLog
	if err := h.db.First(&row, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Usage record not found"})
		return
	}
	var req adminUsageUpdateBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if req.LogCount != nil {
		row.LogCount = *req.LogCount
	}
	if req.BytesIngested != nil {
		row.BytesIngested = *req.BytesIngested
	}
	if err := h.db.Save(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update usage"})
		return
	}
	c.JSON(http.StatusOK, row)
}

func (h *AdminHandler) DeleteUsage(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid usage id"})
		return
	}
	result := h.db.Delete(&models.UsageLog{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete usage"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Usage record not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Usage record deleted successfully"})
}

// ---------- Audit logs ----------

func (h *AdminHandler) ListAuditLogs(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	action := strings.TrimSpace(c.Query("action"))
	orgID := strings.TrimSpace(c.Query("organizationId"))

	query := h.db.Model(&models.AuditLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if orgID != "" {
		query = query.Where("organization_id = ?", orgID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to count audit logs"})
		return
	}
	var rows []models.AuditLog
	if err := query.Preload("User").Order("created_at DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch audit logs"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"auditLogs": rows, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) DeleteAuditLog(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid audit log id"})
		return
	}
	result := h.db.Where("id = ?", id).Delete(&models.AuditLog{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete audit log"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Audit log not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Audit log deleted successfully"})
}

// ---------- helpers ----------

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			prevDash = false
			continue
		}
		if !prevDash {
			b.WriteByte('-')
			prevDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		tok, _ := randomToken(4)
		out = "org-" + tok
	}
	return out
}

func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
