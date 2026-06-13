package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// AdminError represents structured admin authorization errors
type AdminError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func AdminOnly(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, AdminError{
				Code:    "UNAUTHORIZED",
				Message: "Authentication required",
			})
			c.Abort()
			return
		}

		var user models.User
		if err := db.First(&user, userID).Error; err != nil {
			c.JSON(http.StatusInternalServerError, AdminError{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to verify user permissions",
			})
			c.Abort()
			return
		}

		if user.Role != "admin" {
			c.JSON(http.StatusForbidden, AdminError{
				Code:    "FORBIDDEN",
				Message: "Admin access required",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
