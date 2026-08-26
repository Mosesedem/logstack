package handlers

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"gorm.io/gorm"
)

type UsersHandler struct {
	db          *gorm.DB
	authService *services.AuthService
}

func NewUsersHandler(db *gorm.DB, authService *services.AuthService) *UsersHandler {
	return &UsersHandler{
		db:          db,
		authService: authService,
	}
}

type UpdateUserRequest struct {
	Name            string  `json:"name" binding:"omitempty,min=1,max=100"`
	Email           string  `json:"email" binding:"omitempty,email"`
	Country         string  `json:"country" binding:"omitempty,len=2"`
	EscalationEmail *string `json:"escalationEmail" binding:"omitempty"`
}

type UpdatePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required"`
	NewPassword     string `json:"newPassword" binding:"required,min=8,max=72"`
}

// GetCurrentUser handles GET /v1/users/me
func (h *UsersHandler) GetCurrentUser(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "USER_NOT_FOUND",
			Message: "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, user.ToResponse())
}

// UpdateCurrentUser handles PUT /v1/users/me
func (h *UsersHandler) UpdateCurrentUser(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "USER_NOT_FOUND",
			Message: "User not found",
		})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	if req.Name != "" {
		user.Name = strings.TrimSpace(req.Name)
	}
	if req.Email != "" {
		email := strings.ToLower(strings.TrimSpace(req.Email))
		// Check if email is already taken
		var existing models.User
		if err := h.db.Where("email = ? AND id != ?", email, userID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, ErrorResponse{
				Code:    "EMAIL_EXISTS",
				Message: "Email is already in use by another account",
			})
			return
		}
		user.Email = email
	}
	if req.Country != "" {
		country := services.NormalizeCountryCode(req.Country)
		if len(country) != 2 {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Code:    "VALIDATION_ERROR",
				Message: "country must be a 2-letter ISO code (e.g. NG, US)",
			})
			return
		}
		user.Country = &country
	}
	if req.EscalationEmail != nil {
		user.EscalationEmail = strings.TrimSpace(*req.EscalationEmail)
	}

	if err := h.db.Save(&user).Error; err != nil {
		slog.Error("Failed to update user", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to update user",
		})
		return
	}

	slog.Info("User updated", "userID", userID)
	c.JSON(http.StatusOK, user.ToResponse())
}

// UpdatePassword handles PUT /v1/users/me/password
func (h *UsersHandler) UpdatePassword(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "USER_NOT_FOUND",
			Message: "User not found",
		})
		return
	}

	var req UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	if !user.CheckPassword(req.CurrentPassword) {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    "INVALID_PASSWORD",
			Message: "Current password is incorrect",
		})
		return
	}

	if err := user.SetPassword(req.NewPassword); err != nil {
		slog.Error("Failed to hash password", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to update password",
		})
		return
	}

	if err := h.db.Save(&user).Error; err != nil {
		slog.Error("Failed to save user", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to update password",
		})
		return
	}

	// Revoke all existing tokens after password change
	if err := h.authService.RevokeAllUserTokens(c.Request.Context(), userID); err != nil {
		slog.Warn("Failed to revoke user tokens", "error", err, "userID", userID)
	}

	slog.Info("User password updated", "userID", userID)
	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

// LogoutAll handles POST /v1/users/me/logout-all
func (h *UsersHandler) LogoutAll(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	if err := h.authService.RevokeAllUserTokens(c.Request.Context(), userID); err != nil {
		slog.Error("Failed to revoke user tokens", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to logout from all devices",
		})
		return
	}

	slog.Info("User logged out from all devices", "userID", userID)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out from all devices successfully"})
}

// ListDevices handles GET /v1/users/me/devices — push tokens that still receive alerts.
func (h *UsersHandler) ListDevices(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var tokens []models.PushToken
	if err := h.db.Where("user_id = ?", userID).Order("updated_at DESC, id DESC").Find(&tokens).Error; err != nil {
		slog.Error("list devices", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to load devices",
		})
		return
	}

	views := make([]models.DeviceView, 0, len(tokens))
	for _, t := range tokens {
		views = append(views, t.ToDeviceView())
	}

	c.JSON(http.StatusOK, gin.H{
		"devices": views,
		"count":   len(views),
	})
}

// DeleteDevice handles DELETE /v1/users/me/devices/:id
func (h *UsersHandler) DeleteDevice(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "Invalid device id",
		})
		return
	}

	result := h.db.Where("user_id = ? AND id = ?", userID, id).Delete(&models.PushToken{})
	if result.Error != nil {
		slog.Error("delete device", "error", result.Error, "userID", userID, "deviceID", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to remove device",
		})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Device not found",
		})
		return
	}

	slog.Info("push device removed", "userID", userID, "deviceID", id)
	c.JSON(http.StatusOK, gin.H{"message": "Device removed"})
}

// DeleteAllDevices handles DELETE /v1/users/me/devices
func (h *UsersHandler) DeleteAllDevices(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	result := h.db.Where("user_id = ?", userID).Delete(&models.PushToken{})
	if result.Error != nil {
		slog.Error("delete all devices", "error", result.Error, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to remove devices",
		})
		return
	}

	slog.Info("all push devices removed", "userID", userID, "count", result.RowsAffected)
	c.JSON(http.StatusOK, gin.H{
		"message": "Devices removed",
		"removed": result.RowsAffected,
	})
}
