package handlers

import (
	"fmt"
	"html"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
)

type adminNotifyRequest struct {
	Channels  []string
	UserID    *uint
	Email     string
	Broadcast bool
	Title     string
	Message   string
}

func parseAdminNotifyRequest(raw map[string]interface{}) adminNotifyRequest {
	var req adminNotifyRequest
	if title, ok := raw["title"].(string); ok {
		req.Title = title
	}
	if msg, ok := raw["message"].(string); ok {
		req.Message = msg
	}
	if email, ok := raw["email"].(string); ok {
		req.Email = strings.TrimSpace(email)
	}
	if b, ok := raw["broadcast"].(bool); ok {
		req.Broadcast = b
	}
	switch ch := raw["channels"].(type) {
	case []interface{}:
		for _, item := range ch {
			if s, ok := item.(string); ok {
				req.Channels = append(req.Channels, s)
			}
		}
	case []string:
		req.Channels = append(req.Channels, ch...)
	}
	// userId may arrive as float64 (JSON number) or string
	switch v := raw["userId"].(type) {
	case float64:
		if v > 0 {
			id := uint(v)
			req.UserID = &id
		}
	case int:
		if v > 0 {
			id := uint(v)
			req.UserID = &id
		}
	case string:
		v = strings.TrimSpace(v)
		if v != "" {
			var n uint64
			for _, r := range v {
				if r < '0' || r > '9' {
					n = 0
					break
				}
				n = n*10 + uint64(r-'0')
			}
			if n > 0 {
				id := uint(n)
				req.UserID = &id
			}
		}
	}
	return req
}

// SendNotification handles POST /v1/admin/notifications
func (h *AdminHandler) SendNotification(c *gin.Context) {
	if h.notifier == nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Code:    "NOTIFIER_UNAVAILABLE",
			Message: "Notification service is not configured on this server",
		})
		return
	}

	var raw map[string]interface{}
	if err := c.ShouldBindJSON(&raw); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid JSON body: " + err.Error()})
		return
	}

	req := parseAdminNotifyRequest(raw)
	title := strings.TrimSpace(req.Title)
	message := strings.TrimSpace(req.Message)
	if title == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "title is required"})
		return
	}
	if message == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "message is required"})
		return
	}
	if len(title) > 200 {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "title must be at most 200 characters"})
		return
	}
	if len(message) > 4000 {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "message must be at most 4000 characters"})
		return
	}

	wantEmail, wantPush := false, false
	for _, ch := range req.Channels {
		switch strings.ToLower(strings.TrimSpace(ch)) {
		case "email":
			wantEmail = true
		case "push":
			wantPush = true
		case "":
			continue
		default:
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Code:    "VALIDATION_ERROR",
				Message: "channels must be email and/or push",
			})
			return
		}
	}
	if !wantEmail && !wantPush {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "select at least one channel (email, push)",
		})
		return
	}

	type target struct {
		userID uint
		email  string
		name   string
	}
	var targets []target

	if req.Broadcast && wantPush {
		var userIDs []uint
		if err := h.db.Model(&models.PushToken{}).Distinct("user_id").Pluck("user_id", &userIDs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to list push recipients"})
			return
		}
		for _, id := range userIDs {
			var u models.User
			if err := h.db.First(&u, id).Error; err == nil {
				targets = append(targets, target{userID: u.ID, email: u.Email, name: u.Name})
			} else {
				targets = append(targets, target{userID: id})
			}
		}
	} else if req.UserID != nil {
		var u models.User
		if err := h.db.First(&u, *req.UserID).Error; err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Code: "USER_NOT_FOUND", Message: "User not found"})
			return
		}
		targets = append(targets, target{userID: u.ID, email: u.Email, name: u.Name})
	} else if strings.TrimSpace(req.Email) != "" {
		email := strings.ToLower(strings.TrimSpace(req.Email))
		var u models.User
		if err := h.db.Where("email = ?", email).First(&u).Error; err == nil {
			targets = append(targets, target{userID: u.ID, email: u.Email, name: u.Name})
		} else {
			targets = append(targets, target{email: email})
		}
	} else {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "Provide userId, email, or set broadcast=true for push",
		})
		return
	}

	if len(targets) == 0 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "NO_RECIPIENTS",
			Message: "No recipients found",
		})
		return
	}

	emailOK, pushOK := 0, 0
	emailFail, pushFail := 0, 0
	pushTokensFound, pushDevicesSent := 0, 0
	var failures []string

	emailN := h.notifier.GetEmailNotifier()
	pushN := h.notifier.GetPushNotifier()

	for _, t := range targets {
		if wantEmail {
			to := t.email
			if to == "" {
				emailFail++
				failures = append(failures, fmt.Sprintf("email user=%d: no email", t.userID))
			} else if emailN == nil {
				emailFail++
				failures = append(failures, "email: notifier not configured")
			} else {
				htmlBody := fmt.Sprintf(
					`<div style="font-family:system-ui,sans-serif;line-height:1.5">
  <h2 style="margin:0 0 12px">%s</h2>
  <p style="white-space:pre-wrap">%s</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
  <p style="color:#888;font-size:12px">Sent from Logstack Admin</p>
</div>`,
					html.EscapeString(title),
					html.EscapeString(message),
				)
				if err := emailN.SendDirect(c.Request.Context(), to, t.name, title, htmlBody); err != nil {
					emailFail++
					failures = append(failures, fmt.Sprintf("email %s: %v", to, err))
					slog.Warn("admin notify email failed", "to", to, "error", err)
				} else {
					emailOK++
				}
			}
		}

		if wantPush {
			if t.userID == 0 {
				pushFail++
				failures = append(failures, "push: recipient has no user id (email-only target cannot receive push)")
			} else if pushN == nil || !pushN.IsEnabled() {
				pushFail++
				failures = append(failures, "push: FCM not configured on API (set FCM_SERVICE_ACCOUNT_PATH + mount firebase JSON)")
			} else {
				detail, err := pushN.SendDirectDetailed(c.Request.Context(), t.userID, title, message, map[string]string{
					"type":   "admin",
					"source": "admin_dashboard",
				})
				if detail != nil {
					pushTokensFound += detail.TokensFound
					pushDevicesSent += detail.Sent
					if len(detail.Errors) > 0 {
						for _, pe := range detail.Errors {
							failures = append(failures, fmt.Sprintf("push user=%d: %s", t.userID, pe))
						}
					}
				}
				if err != nil {
					pushFail++
					// Avoid duplicating the detailed errors already appended above.
					if detail == nil || len(detail.Errors) == 0 {
						failures = append(failures, fmt.Sprintf("push user=%d: %v", t.userID, err))
					}
					slog.Warn("admin notify push failed", "userId", t.userID, "error", err, "tokens", detail)
				} else {
					pushOK++
				}
			}
		}
	}

	actorID, _ := c.Get("userID")
	slog.Info("admin notification sent",
		"actorID", actorID,
		"targets", len(targets),
		"emailOK", emailOK,
		"pushOK", pushOK,
		"emailFail", emailFail,
		"pushFail", pushFail,
		"pushTokensFound", pushTokensFound,
		"pushDevicesSent", pushDevicesSent,
	)

	results := gin.H{
		"emailSent":       emailOK,
		"emailFailed":     emailFail,
		"pushSent":        pushOK,
		"pushFailed":      pushFail,
		"pushTokensFound": pushTokensFound,
		"pushDevicesSent": pushDevicesSent,
		"recipients":      len(targets),
		"fcmEnabled":      pushN != nil && pushN.IsEnabled(),
	}
	if len(failures) > 0 {
		if len(failures) > 20 {
			failures = append(failures[:20], fmt.Sprintf("…and %d more", len(failures)-20))
		}
		results["errors"] = failures
	}

	if emailOK+pushOK == 0 {
		c.JSON(http.StatusBadGateway, gin.H{
			"code":    "DELIVERY_FAILED",
			"message": "Failed to deliver any notification",
			"results": results,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Notifications dispatched",
		"results": results,
	})
}
