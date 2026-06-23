package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

type ProjectsHandler struct {
	db *gorm.DB
}

func NewProjectsHandler(db *gorm.DB) *ProjectsHandler {
	return &ProjectsHandler{db: db}
}

type CreateProjectRequest struct {
	Name string `json:"name" binding:"required,max=100"`
}

type UpdateProjectRequest struct {
	Name string `json:"name" binding:"required,max=100"`
}

// List handles GET /v1/projects
func (h *ProjectsHandler) List(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	includeArchived := c.Query("includeArchived") == "true"

	query := h.db.Where("owner_id = ?", userID)
	if !includeArchived {
		query = query.Where("archived_at IS NULL")
	}

	var projects []models.Project
	if err := query.Order("created_at DESC").Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to fetch projects",
		})
		return
	}

	responses := make([]models.ProjectResponse, len(projects))
	for i, p := range projects {
		responses[i] = p.ToResponse()
	}

	c.JSON(http.StatusOK, responses)
}

// Create handles POST /v1/projects
func (h *ProjectsHandler) Create(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	apiKey, err := models.GenerateAPIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to generate API key",
		})
		return
	}

	project := models.Project{
		Name:    req.Name,
		OwnerID: userID,
		APIKey:  apiKey,
	}

	if err := h.db.Create(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to create project",
		})
		return
	}

	c.JSON(http.StatusCreated, project.ToResponseWithAPIKey())
}

// Get handles GET /v1/projects/:id
func (h *ProjectsHandler) Get(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid project ID format",
		})
		return
	}

	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "PROJECT_NOT_FOUND",
			Message: "Project not found",
		})
		return
	}

	c.JSON(http.StatusOK, project.ToResponse())
}

// Update handles PUT /v1/projects/:id
func (h *ProjectsHandler) Update(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid project ID format",
		})
		return
	}

	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "PROJECT_NOT_FOUND",
			Message: "Project not found",
		})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	project.Name = req.Name
	if err := h.db.Save(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to update project",
		})
		return
	}

	c.JSON(http.StatusOK, project.ToResponse())
}

// Delete handles DELETE /v1/projects/:id
func (h *ProjectsHandler) Delete(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid project ID format",
		})
		return
	}

	result := h.db.Where("id = ? AND owner_id = ?", projectID, userID).Delete(&models.Project{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to delete project",
		})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "PROJECT_NOT_FOUND",
			Message: "Project not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

// RotateAPIKey handles POST /v1/projects/:id/rotate-key
func (h *ProjectsHandler) RotateAPIKey(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_PROJECT_ID",
			Message: "Invalid project ID format",
		})
		return
	}

	var project models.Project
	if err := h.db.Where("id = ? AND owner_id = ?", projectID, userID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "PROJECT_NOT_FOUND",
			Message: "Project not found",
		})
		return
	}

	newAPIKey, err := models.GenerateAPIKey()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to generate new API key",
		})
		return
	}

	project.APIKey = newAPIKey
	if err := h.db.Save(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to rotate API key",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"apiKey": newAPIKey})
}

// Archive handles PATCH /v1/projects/:id/archive
func (h *ProjectsHandler) Archive(c *gin.Context) {
	projectID := c.MustGet("projectID").(uuid.UUID)

	now := time.Now()
	result := h.db.Model(&models.Project{}).Where("id = ?", projectID).Update("archived_at", &now)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to archive project",
		})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Code:    "PROJECT_NOT_FOUND",
			Message: "Project not found",
		})
		return
	}

	var project models.Project
	if err := h.db.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to fetch updated project",
		})
		return
	}

	c.JSON(http.StatusOK, project.ToResponse())
}
