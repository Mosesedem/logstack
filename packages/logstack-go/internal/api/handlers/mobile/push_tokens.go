package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/mosesedem/logstack/internal/models"
	ws "github.com/mosesedem/logstack/internal/websocket"
	"gorm.io/gorm"
)

type MobileHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewMobileHandler(db *gorm.DB, hub *ws.Hub) *MobileHandler {
	return &MobileHandler{
		db:  db,
		hub: hub,
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

	// Check if token already exists
	var existing models.PushToken
	if err := h.db.Where("token = ?", req.Token).First(&existing).Error; err == nil {
		// Update existing token
		existing.UserID = userID
		existing.DeviceType = req.DeviceType
		if err := h.db.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "push token updated"})
		return
	}

	// Create new token
	token := models.PushToken{
		UserID:     userID,
		Token:      req.Token,
		DeviceType: req.DeviceType,
	}

	if err := h.db.Create(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "push token registered"})
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
