package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services/notification"
	ws "github.com/mosesedem/logstack/internal/websocket"
	"gorm.io/gorm"
)

type MobileHandler struct {
	db       *gorm.DB
	hub      *ws.Hub
	notifier *notification.Service
}

func NewMobileHandler(db *gorm.DB, hub *ws.Hub, notifier *notification.Service) *MobileHandler {
	return &MobileHandler{
		db:       db,
		hub:      hub,
		notifier: notifier,
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for mobile
	},
}

// RegisterPushToken handles POST /v1/mobile/push-token
func (h *MobileHandler) RegisterPushToken(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var req models.PushTokenCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	switch strings.ToLower(strings.TrimSpace(string(req.DeviceType))) {
	case string(models.DeviceTypeIOS), "iphone", "apple":
		req.DeviceType = models.DeviceTypeIOS
	case string(models.DeviceTypeAndroid):
		req.DeviceType = models.DeviceTypeAndroid
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "deviceType must be ios or android"})
		return
	}

	now := time.Now()

	// One active token per platform per user — stale iOS tokens from old builds
	// are the #1 cause of "Firebase Console works, API doesn't".
	if err := h.db.
		Where("user_id = ? AND device_type = ? AND token <> ?", userID, req.DeviceType, req.Token).
		Delete(&models.PushToken{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var existing models.PushToken
	if err := h.db.Where("token = ?", req.Token).First(&existing).Error; err == nil {
		existing.UserID = userID
		existing.DeviceType = req.DeviceType
		existing.UpdatedAt = now
		if err := h.db.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message":     "push token updated",
			"deviceType":  req.DeviceType,
			"maskedToken": maskPushToken(req.Token),
		})
		return
	}

	token := models.PushToken{
		UserID:     userID,
		Token:      req.Token,
		DeviceType: req.DeviceType,
		UpdatedAt:  now,
		CreatedAt:  now,
	}

	var tokenCount int64
	h.db.Model(&models.PushToken{}).Where("user_id = ?", userID).Count(&tokenCount)
	if tokenCount >= 10 {
		var oldest models.PushToken
		if err := h.db.Where("user_id = ?", userID).Order("created_at ASC").First(&oldest).Error; err == nil {
			h.db.Delete(&oldest)
		}
	}

	if err := h.db.Create(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":     "push token registered",
		"deviceType":  req.DeviceType,
		"maskedToken": maskPushToken(req.Token),
	})
}

func maskPushToken(token string) string {
	if len(token) <= 20 {
		return "***"
	}
	return token[:10] + "..." + token[len(token)-10:]
}

// TestPush handles POST /v1/mobile/push-test — sends a test notification to the
// authenticated user's registered device tokens (same path as admin/alerts).
func (h *MobileHandler) TestPush(c *gin.Context) {
	if h.notifier == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notification service unavailable"})
		return
	}
	pushN := h.notifier.GetPushNotifier()
	if pushN == nil || !pushN.IsEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "FCM not configured on API"})
		return
	}

	userID := c.MustGet("userID").(uint)
	detail, err := pushN.SendDirectDetailed(
		c.Request.Context(),
		userID,
		"Logstack API Test",
		"If you see this, server push delivery is working on your device.",
		map[string]string{"type": "test"},
	)
	results := gin.H{}
	if detail != nil {
		results = gin.H{
			"tokensFound":     detail.TokensFound,
			"devicesSent":     detail.Sent,
			"devicesFailed":   detail.Failed,
			"iosTokens":       detail.IOSTokens,
			"iosSent":         detail.IOSSent,
			"iosFailed":       detail.IOSFailed,
			"androidTokens":   detail.AndroidTokens,
			"androidSent":     detail.AndroidSent,
			"androidFailed":   detail.AndroidFailed,
			"errors":          detail.Errors,
		}
	}
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"error":   err.Error(),
			"results": results,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Test push sent",
		"results": results,
	})
}

// DeletePushToken handles DELETE /v1/mobile/push-token
func (h *MobileHandler) DeletePushToken(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	token := c.Query("token")

	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	result := h.db.Where("user_id = ? AND token = ?", userID, token).Delete(&models.PushToken{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "push token deleted"})
}

// Stream handles WebSocket connection for real-time log streaming
func (h *MobileHandler) Stream(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	projectID := c.Query("projectId")

	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "projectId is required"})
		return
	}

	// Verify user has access to project
	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied to project"})
		return
	}

	// Echo Sec-WebSocket-Protocol when clients pass the JWT as a subprotocol.
	responseHeader := http.Header{}
	if proto := c.GetHeader("Sec-WebSocket-Protocol"); proto != "" {
		if selected := strings.TrimSpace(strings.SplitN(proto, ",", 2)[0]); selected != "" {
			responseHeader.Set("Sec-WebSocket-Protocol", selected)
		}
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, responseHeader)
	if err != nil {
		return
	}

	client := ws.NewClient(h.hub, conn, projectID, userID)
	h.hub.Register(client)

	go client.WritePump()
	go client.ReadPump()
}
