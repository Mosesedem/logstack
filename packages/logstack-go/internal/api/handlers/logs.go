package handlers

import (
	"context"
	"errors"
	"fmt"
	"html"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"github.com/mosesedem/logstack/internal/services/notification"
	"gorm.io/gorm"
)

type LogsHandler struct {
	ingestor     *services.Ingestor
	queryBuilder *services.QueryBuilder
	alertEngine  *services.AlertEngine
}

func NewLogsHandler(
	ingestor *services.Ingestor,
	queryBuilder *services.QueryBuilder,
	alertEngine *services.AlertEngine,
) *LogsHandler {
	return &LogsHandler{
		ingestor:     ingestor,
		queryBuilder: queryBuilder,
		alertEngine:  alertEngine,
	}
}

// IngestBatch handles POST /v1/logs
func (h *LogsHandler) IngestBatch(c *gin.Context) {
	projectID := c.MustGet("projectID").(uuid.UUID)

	var req models.LogBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	if len(req.Logs) == 0 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "EMPTY_BATCH",
			Message: "At least one log entry is required",
		})
		return
	}

	logs, err := h.ingestor.IngestBatch(c.Request.Context(), projectID, req.Logs)
	if err != nil {
		slog.Error("Failed to ingest logs", "error", err, "projectId", projectID, "count", len(req.Logs))
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INGEST_ERROR",
			Message: err.Error(),
		})
		return
	}

	if h.alertEngine != nil && len(logs) > 0 {
		batch := append([]models.Log(nil), logs...)
		go func(entries []models.Log) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			for i := range entries {
				if err := h.alertEngine.ProcessLog(ctx, &entries[i]); err != nil {
					slog.Error("Failed to process log for alerts",
						"logId", entries[i].ID,
						"error", err,
					)
				}
			}
		}(batch)
	}

	// Logs are persisted and queryable for every environment.
	c.JSON(http.StatusCreated, gin.H{
		"message":   "Logs ingested successfully",
		"count":     len(logs),
		"persisted": true,
	})
}

// Query handles GET /v1/logs
func (h *LogsHandler) Query(c *gin.Context) {
	projectIDStr := c.Query("projectId")
	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_PROJECT_ID",
			Message: "projectId query parameter is required",
		})
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid projectId format",
		})
		return
	}

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	
	// Enforce limits
	if limit > 1000 {
		limit = 1000
	}
	if limit < 1 {
		limit = 1
	}
	if offset < 0 {
		offset = 0
	}

	opts := services.QueryOptions{
		ProjectID: projectID,
		Offset:    offset,
		Limit:     limit,
		Level:     c.Query("level"),
		Source:    c.Query("source"),
		Search:    c.Query("search"),
	}

	if startTime := c.Query("startTime"); startTime != "" {
		t, err := time.Parse(time.RFC3339, startTime)
		if err == nil {
			opts.StartTime = &t
		}
	}

	if endTime := c.Query("endTime"); endTime != "" {
		t, err := time.Parse(time.RFC3339, endTime)
		if err == nil {
			opts.EndTime = &t
		}
	}

	result, err := h.queryBuilder.Query(opts)
	if err != nil {
		slog.Error("Failed to query logs", "error", err, "projectId", projectID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "QUERY_ERROR",
			Message: "Failed to query logs",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetByID handles GET /v1/logs/:id
func (h *LogsHandler) GetByID(c *gin.Context) {
	projectIDStr := c.Query("projectId")
	if projectIDStr == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_PROJECT_ID",
			Message: "projectId query parameter is required",
		})
		return
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid projectId format",
		})
		return
	}

	logID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid log ID",
		})
		return
	}

	log, err := h.queryBuilder.GetByID(logID, projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Log not found",
		})
		return
	}

	c.JSON(http.StatusOK, log)
}

// ProjectLogsHandler handles log queries from the dashboard (with JWT auth)
type ProjectLogsHandler struct {
	queryBuilder *services.QueryBuilder
	db           *gorm.DB
	notifier     *notification.Service
}

func NewProjectLogsHandler(
	queryBuilder *services.QueryBuilder,
	db *gorm.DB,
	notifier *notification.Service,
) *ProjectLogsHandler {
	return &ProjectLogsHandler{
		queryBuilder: queryBuilder,
		db:           db,
		notifier:     notifier,
	}
}

// Analytics handles GET /v1/projects/:id/logs/analytics
func (h *ProjectLogsHandler) Analytics(c *gin.Context) {
	projectID := c.MustGet("projectID").(uuid.UUID)

	result, err := h.queryBuilder.Analytics(projectID, 24)
	if err != nil {
		slog.Error("Failed to get log analytics", "error", err, "projectId", projectID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "ANALYTICS_ERROR",
			Message: "Failed to compute log analytics",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Query handles GET /v1/projects/:id/logs
func (h *ProjectLogsHandler) Query(c *gin.Context) {
	projectID := c.MustGet("projectID").(uuid.UUID)

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	
	// Enforce limits
	if limit > 200 {
		limit = 200
	}
	if limit < 1 {
		limit = 1
	}
	if offset < 0 {
		offset = 0
	}

	opts := services.QueryOptions{
		ProjectID: projectID,
		Offset:    offset,
		Limit:     limit,
		Level:     c.Query("level"),
		Source:    c.Query("source"),
		Search:    c.Query("search"),
	}

	if startTime := c.Query("startTime"); startTime != "" {
		t, err := time.Parse(time.RFC3339, startTime)
		if err == nil {
			opts.StartTime = &t
		}
	}

	if endTime := c.Query("endTime"); endTime != "" {
		t, err := time.Parse(time.RFC3339, endTime)
		if err == nil {
			opts.EndTime = &t
		}
	}

	result, err := h.queryBuilder.Query(opts)
	if err != nil {
		slog.Error("Failed to query project logs", "error", err, "projectId", projectID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "QUERY_ERROR",
			Message: "Failed to query logs",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetByID handles GET /v1/projects/:id/logs/:logId (JWT + project ownership).
func (h *ProjectLogsHandler) GetByID(c *gin.Context) {
	projectID := c.MustGet("projectID").(uuid.UUID)

	logID, err := strconv.ParseInt(c.Param("logId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid log ID",
		})
		return
	}

	log, err := h.queryBuilder.GetByID(logID, projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Log not found",
		})
		return
	}

	c.JSON(http.StatusOK, log)
}

// Escalate handles POST /v1/projects/:id/logs/:logId/escalate
func (h *ProjectLogsHandler) Escalate(c *gin.Context) {
	projectID := c.MustGet("projectID").(uuid.UUID)
	userID := c.MustGet("userID").(uint)

	logID, err := strconv.ParseInt(c.Param("logId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_ID",
			Message: "Invalid log ID",
		})
		return
	}

	log, err := h.queryBuilder.GetByID(logID, projectID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "NOT_FOUND",
			Message: "Log not found",
		})
		return
	}

	var existing models.LogEscalation
	findErr := h.db.Where("log_id = ? AND user_id = ?", logID, userID).First(&existing).Error
	if findErr == nil {
		c.JSON(http.StatusOK, models.LogEscalationResponse{
			Escalated:   true,
			AlreadyDone: true,
			Message:     "This log was already escalated by you",
		})
		return
	}
	if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to check escalation status",
		})
		return
	}

	escalation := models.LogEscalation{
		LogID:     logID,
		ProjectID: projectID,
		UserID:    userID,
	}
	if err := h.db.Create(&escalation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to record escalation",
		})
		return
	}

	var project models.Project
	if err := h.db.Preload("Owner").First(&project, "id = ?", projectID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to resolve project owner",
		})
		return
	}

	notified := []string{}
	if h.notifier != nil {
		// 1. Push notification
		if h.notifier.GetPushNotifier() != nil {
			title := "Logstack: log escalated"
			body := fmt.Sprintf("[%s] %s", log.Level, truncateEscalationMessage(log.Message))
			data := map[string]string{
				"logId":     fmt.Sprintf("%d", log.ID),
				"projectId": log.ProjectID.String(),
				"level":     string(log.Level),
				"type":      "escalation",
			}
			ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
			defer cancel()
			if err := h.notifier.GetPushNotifier().SendDirect(ctx, project.OwnerID, title, body, data); err == nil {
				notified = append(notified, "push")
			} else {
				slog.Warn("escalation push failed", "error", err, "ownerId", project.OwnerID)
			}
		}

		// 2. Email notification
		if h.notifier.GetEmailNotifier() != nil {
			recipientEmail := project.Owner.EscalationEmail
			if recipientEmail == "" {
				recipientEmail = project.Owner.Email
			}
			if recipientEmail != "" {
				ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
				defer cancel()
				if err := h.notifier.CheckAndIncrementEmailLimit(ctx, project.OwnerID); err != nil {
					slog.Warn("escalation email blocked by limit", "error", err, "ownerId", project.OwnerID)
				} else {
					subject := "Logstack Escalation Alert"
					content := notification.StandardEmail{
						Title:    subject,
						Greeting: fmt.Sprintf("Hello %s,", project.Owner.Name),
						MessageHTML: fmt.Sprintf(
							`<p>A log has been escalated in your project <strong>%s</strong>:</p>
							<p><strong>Level:</strong> %s<br>
							<strong>Source:</strong> %s<br>
							<strong>Time:</strong> %s</p>
							<p><strong>Message:</strong><br><code style="font-size:13px;background-color:#f5f5f5;padding:8px;display:block;border-radius:4px;white-space:pre-wrap;">%s</code></p>`,
							html.EscapeString(project.Name),
							html.EscapeString(string(log.Level)),
							html.EscapeString(log.Source),
							html.EscapeString(log.CreatedAt.Format("2006-01-02 15:04:05 MST")),
							html.EscapeString(log.Message),
						),
						ButtonURL:  fmt.Sprintf("%s/logs?projectId=%s", h.notifier.GetEmailNotifier().BaseURL(), project.ID.String()),
						ButtonText: "View Logs",
					}
					if err := h.notifier.GetEmailNotifier().SendStandard(ctx, recipientEmail, project.Owner.Name, subject, content); err == nil {
						notified = append(notified, "email")
					} else {
						slog.Warn("escalation email failed", "error", err, "ownerId", project.OwnerID)
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, models.LogEscalationResponse{
		Escalated: true,
		Notified:  notified,
		Message:   escalationSuccessMessage(notified),
	})
}

func truncateEscalationMessage(msg string) string {
	if len(msg) <= 120 {
		return msg
	}
	return msg[:117] + "..."
}

func escalationSuccessMessage(notified []string) string {
	if len(notified) == 0 {
		return "Log escalated. Install the mobile app and enable push on the project owner account, or configure email, for instant alerts."
	}
	return fmt.Sprintf("Log escalated. Notified via %s.", strings.Join(notified, " and "))
}
