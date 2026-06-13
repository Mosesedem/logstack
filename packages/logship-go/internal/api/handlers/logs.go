package handlers

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
)

type LogsHandler struct {
	ingestor     *services.Ingestor
	queryBuilder *services.QueryBuilder
}

func NewLogsHandler(ingestor *services.Ingestor, queryBuilder *services.QueryBuilder) *LogsHandler {
	return &LogsHandler{
		ingestor:     ingestor,
		queryBuilder: queryBuilder,
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

	// Check if logs are ephemeral (non-production environment)
	var project models.Project
	ephemeral := false
	if err := h.ingestor.GetDB().Select("environment").First(&project, "id = ?", projectID).Error; err == nil {
		ephemeral = project.Environment != "production"
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":   "Logs ingested successfully",
		"count":     len(logs),
		"ephemeral": ephemeral,
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
}

func NewProjectLogsHandler(queryBuilder *services.QueryBuilder) *ProjectLogsHandler {
	return &ProjectLogsHandler{
		queryBuilder: queryBuilder,
	}
}

// Query handles GET /v1/projects/:id/logs
func (h *ProjectLogsHandler) Query(c *gin.Context) {
	projectID := c.MustGet("projectID").(uuid.UUID)

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
