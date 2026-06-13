package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// ProjectAuth middleware ensures user has access to the requested project
func ProjectAuth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectIDStr := c.Param("id")
		if projectIDStr == "" {
			// No project ID in path, skip authorization
			c.Next()
			return
		}

		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, AuthError{
				Code:    "INVALID_PROJECT_ID",
				Message: "Invalid project ID format",
			})
			c.Abort()
			return
		}

		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, AuthError{
				Code:    "UNAUTHORIZED",
				Message: "Authentication required",
			})
			c.Abort()
			return
		}

		var project models.Project
		if err := db.Where("id = ?", projectID).First(&project).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, AuthError{
					Code:    "PROJECT_NOT_FOUND",
					Message: "Project not found",
				})
			} else {
				c.JSON(http.StatusInternalServerError, AuthError{
					Code:    "DATABASE_ERROR",
					Message: "Failed to fetch project",
				})
			}
			c.Abort()
			return
		}

		// Check ownership
		if project.OwnerID != userID.(uint) {
			c.JSON(http.StatusForbidden, AuthError{
				Code:    "FORBIDDEN",
				Message: "You do not have access to this project",
			})
			c.Abort()
			return
		}

		// Set project in context for handlers to use
		c.Set("project", &project)
		c.Set("projectID", project.ID)
		c.Next()
	}
}

// RequireProjectOwner is an explicit check that the user owns the project
func RequireProjectOwner(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectIDStr := c.Param("id")
		if projectIDStr == "" {
			projectIDStr = c.Param("projectId")
		}
		
		if projectIDStr == "" {
			c.JSON(http.StatusBadRequest, AuthError{
				Code:    "MISSING_PROJECT_ID",
				Message: "Project ID is required",
			})
			c.Abort()
			return
		}

		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, AuthError{
				Code:    "INVALID_PROJECT_ID",
				Message: "Invalid project ID format",
			})
			c.Abort()
			return
		}

		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, AuthError{
				Code:    "UNAUTHORIZED",
				Message: "Authentication required",
			})
			c.Abort()
			return
		}

		var project models.Project
		result := db.Where("id = ? AND owner_id = ?", projectID, userID).First(&project)
		
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				c.JSON(http.StatusForbidden, AuthError{
					Code:    "FORBIDDEN",
					Message: "You do not have access to this project",
				})
			} else {
				c.JSON(http.StatusInternalServerError, AuthError{
					Code:    "DATABASE_ERROR",
					Message: "Failed to verify project access",
				})
			}
			c.Abort()
			return
		}

		c.Set("project", &project)
		c.Set("projectID", project.ID)
		c.Next()
	}
}
