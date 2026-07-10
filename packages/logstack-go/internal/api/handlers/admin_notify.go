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
	// Channels: "email", "push" (at least one required)
	Channels []string `json:"channels" binding:"required,min=1"`
	// Target: userId and/or email. If userId set, email is resolved from the user
	// when sending email and push is delivered to that user's devices.
	UserID *uint  `json:"userId"`
	Email  string `json:"email" binding:"omitempty,email"`
	// Broadcast to every user with a registered push token (push only).
	Broadcast bool `json:"broadcast"`

	Title   string `json:"title" binding:"required,min=1,max=200"`
	Message string `json:"message" binding:"required,min=1,max=4000"`
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

	var req adminNotifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}

	wantEmail, wantPush := false, false
	for _, ch := range req.Channels {
		switch strings.ToLower(strings.TrimSpace(ch)) {
		case "email":
			wantEmail = true
		case "push":
			wantPush = true
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
			Message: "select at least one channel",
		})
		return
	}

	title := strings.TrimSpace(req.Title)
	message := strings.TrimSpace(req.Message)

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
				failures = append(failures, "push: recipient has no user id")
			} else if pushN == nil {
				pushFail++
				failures = append(failures, "push: FCM not configured")
			} else {
				if err := pushN.SendDirect(c.Request.Context(), t.userID, title, message, map[string]string{
					"type":   "admin",
					"source": "admin_dashboard",
				}); err != nil {
					pushFail++
					failures = append(failures, fmt.Sprintf("push user=%d: %v", t.userID, err))
					slog.Warn("admin notify push failed", "userId", t.userID, "error", err)
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
	)

	results := gin.H{
		"emailSent":   emailOK,
		"emailFailed": emailFail,
		"pushSent":    pushOK,
		"pushFailed":  pushFail,
		"recipients":  len(targets),
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
