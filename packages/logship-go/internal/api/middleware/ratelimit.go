package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type RateLimiter struct {
	redis     *redis.Client
	requests  int
	window    time.Duration
	keyPrefix string
}

func NewRateLimiter(redisClient *redis.Client, requests int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		redis:     redisClient,
		requests:  requests,
		window:    window,
		keyPrefix: "ratelimit:",
	}
}

// Limit applies rate limiting based on client IP
func (rl *RateLimiter) Limit() gin.HandlerFunc {
	return rl.limitByKey(func(c *gin.Context) string {
		return "ip:" + c.ClientIP()
	})
}

// LimitByUser applies rate limiting based on authenticated user
func (rl *RateLimiter) LimitByUser() gin.HandlerFunc {
	return rl.limitByKey(func(c *gin.Context) string {
		if userID, exists := c.Get("userID"); exists {
			return fmt.Sprintf("user:%v", userID)
		}
		return "ip:" + c.ClientIP()
	})
}

// LimitByAPIKey applies rate limiting based on API key
func (rl *RateLimiter) LimitByAPIKey() gin.HandlerFunc {
	return rl.limitByKey(func(c *gin.Context) string {
		if projectID, exists := c.Get("projectID"); exists {
			return fmt.Sprintf("project:%v", projectID)
		}
		return "ip:" + c.ClientIP()
	})
}

func (rl *RateLimiter) limitByKey(keyFunc func(*gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if rl.redis == nil {
			c.Next()
			return
		}

		ctx := context.Background()
		key := rl.keyPrefix + keyFunc(c)

		// Use sliding window rate limiting with Redis
		now := time.Now().UnixMilli()
		windowStart := now - rl.window.Milliseconds()

		pipe := rl.redis.Pipeline()
		
		// Remove old entries
		pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(windowStart, 10))
		
		// Count current requests
		countCmd := pipe.ZCard(ctx, key)
		
		_, err := pipe.Exec(ctx)
		if err != nil && err != redis.Nil {
			// Redis error - fail open
			c.Next()
			return
		}

		count := countCmd.Val()
		remaining := rl.requests - int(count) - 1

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(rl.requests))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(max(0, remaining)))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(rl.window).Unix(), 10))

		if int(count) >= rl.requests {
			retryAfter := rl.window.Seconds()
			c.Header("Retry-After", strconv.FormatFloat(retryAfter, 'f', 0, 64))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":      "Rate limit exceeded",
				"code":       "RATE_LIMIT_EXCEEDED",
				"retryAfter": retryAfter,
			})
			c.Abort()
			return
		}

		// Add current request to the window
		rl.redis.ZAdd(ctx, key, redis.Z{
			Score:  float64(now),
			Member: fmt.Sprintf("%d", now),
		})
		rl.redis.Expire(ctx, key, rl.window)

		c.Next()
	}
}

// max returns the larger of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// CustomRateLimiter allows custom rate limits per endpoint
type CustomRateLimiter struct {
	redis  *redis.Client
	limits map[string]RateLimitConfig
}

type RateLimitConfig struct {
	Requests int
	Window   time.Duration
}

func NewCustomRateLimiter(redisClient *redis.Client) *CustomRateLimiter {
	return &CustomRateLimiter{
		redis:  redisClient,
		limits: make(map[string]RateLimitConfig),
	}
}

func (crl *CustomRateLimiter) SetLimit(path string, requests int, window time.Duration) {
	crl.limits[path] = RateLimitConfig{
		Requests: requests,
		Window:   window,
	}
}

func (crl *CustomRateLimiter) Limit() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.FullPath()
		config, exists := crl.limits[path]
		if !exists {
			c.Next()
			return
		}

		limiter := NewRateLimiter(crl.redis, config.Requests, config.Window)
		limiter.Limit()(c)
	}
}
