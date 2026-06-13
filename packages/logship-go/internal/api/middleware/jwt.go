package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/services"
)

// AuthError represents structured authentication errors
type AuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func JWTAuth(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, AuthError{
				Code:    "MISSING_TOKEN",
				Message: "Authorization header is required",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			c.JSON(http.StatusUnauthorized, AuthError{
				Code:    "INVALID_FORMAT",
				Message: "Authorization header must be in format: Bearer <token>",
			})
			c.Abort()
			return
		}

		token := strings.TrimSpace(parts[1])
		if token == "" {
			c.JSON(http.StatusUnauthorized, AuthError{
				Code:    "EMPTY_TOKEN",
				Message: "Token cannot be empty",
			})
			c.Abort()
			return
		}

		claims, err := authService.ValidateToken(token)
		if err != nil {
			// Check if token is blacklisted
			if authService.IsTokenBlacklisted(c.Request.Context(), token) {
				c.JSON(http.StatusUnauthorized, AuthError{
					Code:    "TOKEN_REVOKED",
					Message: "Token has been revoked",
				})
				c.Abort()
				return
			}

			c.JSON(http.StatusUnauthorized, AuthError{
				Code:    "INVALID_TOKEN",
				Message: "Token is invalid or expired",
			})
			c.Abort()
			return
		}

		// Validate claims
		if claims.UserID == 0 {
			c.JSON(http.StatusUnauthorized, AuthError{
				Code:    "INVALID_CLAIMS",
				Message: "Token contains invalid claims",
			})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("token", token)
		c.Next()
	}
}

// OptionalJWTAuth is like JWTAuth but doesn't fail if no token is provided
func OptionalJWTAuth(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			c.Next()
			return
		}

		token := strings.TrimSpace(parts[1])
		if token == "" {
			c.Next()
			return
		}

		claims, err := authService.ValidateToken(token)
		if err != nil || authService.IsTokenBlacklisted(c.Request.Context(), token) {
			c.Next()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("userEmail", claims.Email)
		c.Set("token", token)
		c.Next()
	}
}
