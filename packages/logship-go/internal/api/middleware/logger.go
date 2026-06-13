package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method
		requestID, _ := c.Get("requestID")

		if query != "" {
			path = path + "?" + query
		}

		// Determine log level based on status
		logFn := slog.Info
		if status >= 500 {
			logFn = slog.Error
		} else if status >= 400 {
			logFn = slog.Warn
		}

		logFn("HTTP request",
			"status", status,
			"method", method,
			"path", path,
			"clientIP", clientIP,
			"latency", latency.String(),
			"latencyMs", latency.Milliseconds(),
			"requestID", requestID,
			"userAgent", c.Request.UserAgent(),
			"size", c.Writer.Size(),
		)
	}
}

// ErrorLogger logs errors with additional context
func ErrorLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check for errors
		if len(c.Errors) > 0 {
			requestID, _ := c.Get("requestID")
			for _, err := range c.Errors {
				slog.Error("Request error",
					"error", err.Error(),
					"requestID", requestID,
					"path", c.Request.URL.Path,
					"method", c.Request.Method,
				)
			}
		}
	}
}
