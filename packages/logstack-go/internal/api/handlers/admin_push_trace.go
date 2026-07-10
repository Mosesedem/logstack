package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services/notification"
)

// GetPushTrace handles GET /v1/admin/push-trace — recent push register/send events.
func (h *AdminHandler) GetPushTrace(c *gin.Context) {
	limit := 50
	if raw := c.Query("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"events": notification.RecentPushTrace(limit),
		"limit":  limit,
	})
}

// GetPushTokens handles GET /v1/admin/push-tokens?userId= — DB tokens for a user.
func (h *AdminHandler) GetPushTokens(c *gin.Context) {
	raw := c.Query("userId")
	if raw == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "userId query parameter is required",
		})
		return
	}

	userID, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || userID == 0 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "userId must be a positive integer",
		})
		return
	}

	var tokens []models.PushToken
	if err := h.db.Where("user_id = ?", uint(userID)).Order("updated_at DESC").Find(&tokens).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to load push tokens",
		})
		return
	}

	type tokenView struct {
		ID         uint   `json:"id"`
		DeviceType string `json:"deviceType"`
		MaskedToken string `json:"maskedToken"`
		UpdatedAt  string `json:"updatedAt"`
		CreatedAt  string `json:"createdAt"`
	}

	views := make([]tokenView, 0, len(tokens))
	for _, t := range tokens {
		masked := t.Token
		if len(masked) > 20 {
			masked = masked[:10] + "..." + masked[len(masked)-10:]
		} else if masked != "" {
			masked = "***"
		}
		views = append(views, tokenView{
			ID:          t.ID,
			DeviceType:  string(t.DeviceType),
			MaskedToken: masked,
			UpdatedAt:   t.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z"),
			CreatedAt:   t.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"userId": uint(userID),
		"count":  len(views),
		"tokens": views,
	})
}