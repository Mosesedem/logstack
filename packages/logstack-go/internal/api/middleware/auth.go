package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// APIKeyError represents structured API key authentication errors
type APIKeyError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func APIKeyAuth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, APIKeyError{
				Code:    "MISSING_AUTHORIZATION",
				Message: "Authorization header is required",
			})
			c.Abort()
			return
		}

		// Extract API key from "Bearer <key>" format
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, APIKeyError{
				Code:    "INVALID_FORMAT",
				Message: "Authorization header must be in format: Bearer <api_key>",
			})
			c.Abort()
			return
		}

		apiKey := parts[1]
		if !strings.HasPrefix(apiKey, "ls_") {
			c.JSON(http.StatusUnauthorized, APIKeyError{
				Code:    "INVALID_API_KEY_FORMAT",
				Message: "API key must start with 'ls_' prefix",
			})
			c.Abort()
			return
		}

		// Look up project by API key
		var project models.Project
		if err := db.Where("api_key = ?", apiKey).First(&project).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusUnauthorized, APIKeyError{
					Code:    "INVALID_API_KEY",
					Message: "API key is invalid or has been revoked",
				})
			} else {
				c.JSON(http.StatusInternalServerError, APIKeyError{
					Code:    "INTERNAL_ERROR",
					Message: "Failed to validate API key",
				})
			}
			c.Abort()
			return
		}

		// Set project in context
		c.Set("project", &project)
		c.Set("projectID", project.ID)
		c.Next()
	}
}
