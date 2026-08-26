package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

// ListDevices handles GET /v1/users/me/devices — signed-in sessions plus push tokens.
func (h *UsersHandler) ListDevices(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var sessions []models.MobileRefreshToken
	if err := h.db.Where("user_id = ? AND revoked = ?", userID, false).
		Order("created_at DESC").Find(&sessions).Error; err != nil {
		slog.Error("list device sessions", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to load devices",
		})
		return
	}

	var tokens []models.PushToken
	if err := h.db.Where("user_id = ?", userID).Order("updated_at DESC, id DESC").Find(&tokens).Error; err != nil {
		slog.Error("list device push tokens", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to load devices",
		})
		return
	}

	views := mergeDeviceViews(sessions, tokens)
	c.JSON(http.StatusOK, gin.H{
		"devices": views,
		"count":   len(views),
	})
}

func mergeDeviceViews(sessions []models.MobileRefreshToken, tokens []models.PushToken) []models.DeviceView {
	usedPush := make(map[uint]bool, len(tokens))
	views := make([]models.DeviceView, 0, len(sessions)+len(tokens))

	for _, session := range sessions {
		view := sessionToDeviceView(session)
		for _, token := range tokens {
			if token.SessionID != nil && *token.SessionID == session.ID {
				attachPush(&view, token)
				usedPush[token.ID] = true
				break
			}
		}
		views = append(views, view)
	}

	for _, token := range tokens {
		if usedPush[token.ID] {
			continue
		}
		views = append(views, token.ToDeviceView())
	}
	return views
}

func sessionToDeviceView(session models.MobileRefreshToken) models.DeviceView {
	lastSeen := session.CreatedAt
	if session.LastUsedAt != nil && session.LastUsedAt.After(lastSeen) {
		lastSeen = *session.LastUsedAt
	}
	deviceType := models.DeviceType(strings.ToLower(strings.TrimSpace(session.DeviceInfo)))
	if deviceType != models.DeviceTypeIOS && deviceType != models.DeviceTypeAndroid {
		deviceType = ""
	}
	return models.DeviceView{
		ID:         models.DeviceIDPrefixSession + session.ID.String(),
		DeviceType: deviceType,
		LastSeenAt: lastSeen.UTC(),
		CreatedAt:  session.CreatedAt.UTC(),
		SignedIn:   true,
	}
}

func attachPush(view *models.DeviceView, token models.PushToken) {
	view.DeviceType = token.DeviceType
	view.MaskedToken = models.MaskPushToken(token.Token)
	view.PushEnabled = true
	if token.UpdatedAt.After(view.LastSeenAt) {
		view.LastSeenAt = token.UpdatedAt.UTC()
	}
}

// DeleteDevice handles DELETE /v1/users/me/devices/:id
// Removes the push token and revokes the mobile session so the app is logged out.
func (h *UsersHandler) DeleteDevice(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "Invalid device id",
		})
		return
	}

	removed, err := h.removeDevice(userID, id)
	if err != nil {
		slog.Error("delete device", "error", err, "userID", userID, "deviceID", id)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to remove device",
		})
		return
	}
	if !removed {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Device not found",
		})
		return
	}

	slog.Info("device logged out and removed", "userID", userID, "deviceID", id)
	c.JSON(http.StatusOK, gin.H{"message": "Device logged out"})
}

// DeleteAllDevices handles DELETE /v1/users/me/devices
func (h *UsersHandler) DeleteAllDevices(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	if err := h.db.Model(&models.MobileRefreshToken{}).
		Where("user_id = ? AND revoked = ?", userID, false).
		Update("revoked", true).Error; err != nil {
		slog.Error("revoke all mobile sessions", "error", err, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to log out devices",
		})
		return
	}

	result := h.db.Where("user_id = ?", userID).Delete(&models.PushToken{})
	if result.Error != nil {
		slog.Error("delete all devices", "error", result.Error, "userID", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to remove devices",
		})
		return
	}

	slog.Info("all mobile devices logged out", "userID", userID, "pushRemoved", result.RowsAffected)
	c.JSON(http.StatusOK, gin.H{
		"message": "Devices logged out",
		"removed": result.RowsAffected,
	})
}

func (h *UsersHandler) removeDevice(userID uint, id string) (bool, error) {
	switch {
	case strings.HasPrefix(id, models.DeviceIDPrefixSession):
		sessionID, err := uuid.Parse(strings.TrimPrefix(id, models.DeviceIDPrefixSession))
		if err != nil {
			return false, nil
		}
		return h.revokeSession(userID, sessionID)
	case strings.HasPrefix(id, models.DeviceIDPrefixPush):
		pushID, err := strconv.ParseUint(strings.TrimPrefix(id, models.DeviceIDPrefixPush), 10, 64)
		if err != nil || pushID == 0 {
			return false, nil
		}
		return h.removePushToken(userID, uint(pushID))
	default:
		// Older clients sent the numeric push-token id.
		pushID, err := strconv.ParseUint(id, 10, 64)
		if err != nil || pushID == 0 {
			return false, nil
		}
		return h.removePushToken(userID, uint(pushID))
	}
}

func (h *UsersHandler) revokeSession(userID uint, sessionID uuid.UUID) (bool, error) {
	result := h.db.Model(&models.MobileRefreshToken{}).
		Where("id = ? AND user_id = ? AND revoked = ?", sessionID, userID, false).
		Update("revoked", true)
	if result.Error != nil {
		return false, result.Error
	}
	if err := h.db.Where("user_id = ? AND session_id = ?", userID, sessionID).
		Delete(&models.PushToken{}).Error; err != nil {
		return false, err
	}
	return result.RowsAffected > 0, nil
}

func (h *UsersHandler) removePushToken(userID uint, pushID uint) (bool, error) {
	var token models.PushToken
	if err := h.db.Where("id = ? AND user_id = ?", pushID, userID).First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	if err := h.db.Delete(&token).Error; err != nil {
		return false, err
	}
	if token.SessionID != nil {
		if _, err := h.revokeSession(userID, *token.SessionID); err != nil {
			return false, err
		}
	}
	return true, nil
}
