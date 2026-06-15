package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/db"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// Health returns basic health status (liveness probe)
func Health(database *gorm.DB, redisClient *redis.Client) gin.HandlerFunc {
	startTime := time.Now()
	
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "logstack-api",
			"time":    time.Now().UTC().Format(time.RFC3339),
			"uptime":  time.Since(startTime).String(),
		})
	}
}

// Ready checks all dependencies (readiness probe)
func Ready(database *gorm.DB, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		checks := make(map[string]string)
		healthy := true

		// Check database
		if err := db.HealthCheck(database); err != nil {
			checks["database"] = "unhealthy: " + err.Error()
			healthy = false
		} else {
			checks["database"] = "healthy"
		}

		// Check Redis
		if err := redisClient.Ping(c.Request.Context()).Err(); err != nil {
			checks["redis"] = "unhealthy: " + err.Error()
			healthy = false
		} else {
			checks["redis"] = "healthy"
		}

		status := http.StatusOK
		statusText := "ready"
		if !healthy {
			status = http.StatusServiceUnavailable
			statusText = "unhealthy"
		}

		c.JSON(status, gin.H{
			"status": statusText,
			"checks": checks,
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// Stats returns server statistics (for monitoring)
func Stats(database *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := db.GetDBStats(database)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"database": stats,
		})
	}
}

// Test returns a simple test response to verify the API is working
func Test() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "success",
			"message":   "LogStack API is working!",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   "1.0.0",
			"endpoints": gin.H{
				"health": "/health",
				"ready":  "/ready",
				"test":   "/test",
			},
		})
	}
}
