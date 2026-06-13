package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// UsageLimitMiddleware enforces tier-based usage limits on log ingestion
type UsageLimitMiddleware struct {
	db    *gorm.DB
	redis *redis.Client
}

// NewUsageLimitMiddleware creates a new usage limit middleware
func NewUsageLimitMiddleware(db *gorm.DB, redis *redis.Client) *UsageLimitMiddleware {
	return &UsageLimitMiddleware{
		db:    db,
		redis: redis,
	}
}

// Enforce checks if the user has exceeded their tier's log limit
func (m *UsageLimitMiddleware) Enforce() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get project from context (set by APIKeyAuth middleware)
		projectIDVal, exists := c.Get("projectID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "project not found in context"})
			c.Abort()
			return
		}

		projectID, ok := projectIDVal.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid project ID type"})
			c.Abort()
			return
		}

		ctx := context.Background()

		// Get owner ID from project context or fetch it
		ownerID, err := m.getProjectOwnerID(c, projectID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get project owner"})
			c.Abort()
			return
		}

		// Get user's subscription tier
		tier, err := m.getUserTier(ctx, ownerID)
		if err != nil {
			// If no subscription found, default to free tier
			tier = models.TierFree
		}

		// Get tier limit
		limit := tier.LogLimit()
		
		// Enterprise tier has unlimited logs
		if limit < 0 {
			c.Next()
			return
		}

		// Get current usage from Redis (fast path)
		currentUsage, err := m.getCurrentUsage(ctx, ownerID)
		if err != nil {
			// If Redis fails, fallback to PostgreSQL
			currentUsage, err = m.getCurrentUsageFromDB(ctx, ownerID)
			if err != nil {
				// Log error but allow request to continue
				// We don't want billing issues to block legitimate requests
				c.Next()
				return
			}
		}

		// Check if limit exceeded
		if currentUsage >= limit {
			c.Header("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
			c.Header("X-RateLimit-Remaining", "0")
			c.Header("X-RateLimit-Reset", getMonthEndTimestamp())
			c.Header("Retry-After", strconv.Itoa(getSecondsUntilMonthEnd()))

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "monthly log limit exceeded",
				"code":        "USAGE_LIMIT_EXCEEDED",
				"currentUsage": currentUsage,
				"limit":       limit,
				"tier":        tier,
				"upgradeUrl":  "/dashboard/billing",
				"message":     fmt.Sprintf("You have used %d of %d logs this month. Please upgrade your plan to continue.", currentUsage, limit),
			})
			c.Abort()
			return
		}

		// Set remaining quota in response headers
		remaining := limit - currentUsage
		c.Header("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
		c.Header("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
		c.Header("X-RateLimit-Reset", getMonthEndTimestamp())

		// Store usage info in context for later use
		c.Set("userTier", tier)
		c.Set("usageLimit", limit)
		c.Set("currentUsage", currentUsage)
		c.Set("ownerID", ownerID)

		c.Next()
	}
}

// getProjectOwnerID fetches the owner ID for a project
func (m *UsageLimitMiddleware) getProjectOwnerID(c *gin.Context, projectID uuid.UUID) (uint, error) {
	// Check if already in context
	if ownerID, exists := c.Get("ownerID"); exists {
		if id, ok := ownerID.(uint); ok {
			return id, nil
		}
	}

	// Fetch from database
	var project models.Project
	if err := m.db.Select("owner_id").Where("id = ?", projectID).First(&project).Error; err != nil {
		return 0, err
	}

	return project.OwnerID, nil
}

// getUserTier fetches the user's subscription tier
func (m *UsageLimitMiddleware) getUserTier(ctx context.Context, userID uint) (models.SubscriptionTier, error) {
	// Try to get from Redis cache first
	cacheKey := fmt.Sprintf("user:tier:%d", userID)
	tierStr, err := m.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		return models.SubscriptionTier(tierStr), nil
	}

	// Fetch from database
	var subscription models.Subscription
	if err := m.db.WithContext(ctx).Select("tier").Where("user_id = ?", userID).First(&subscription).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.TierFree, nil
		}
		return models.TierFree, err
	}

	// Cache the tier for 5 minutes
	m.redis.Set(ctx, cacheKey, string(subscription.Tier), 5*time.Minute)

	return subscription.Tier, nil
}

// getCurrentUsage gets the current month's usage from Redis
func (m *UsageLimitMiddleware) getCurrentUsage(ctx context.Context, userID uint) (int64, error) {
	// Get all project IDs for this user
	var projectIDs []uuid.UUID
	if err := m.db.WithContext(ctx).Model(&models.Project{}).
		Where("owner_id = ?", userID).
		Pluck("id", &projectIDs).Error; err != nil {
		return 0, err
	}

	if len(projectIDs) == 0 {
		return 0, nil
	}

	// Sum usage from Redis for all projects
	var totalUsage int64
	month := models.GetCurrentMonth().Format("2006-01")
	
	for _, projectID := range projectIDs {
		key := "usage:" + month + ":" + projectID.String()
		count, err := m.redis.Get(ctx, key).Int64()
		if err != nil && err != redis.Nil {
			continue // Ignore errors for individual projects
		}
		totalUsage += count
	}

	return totalUsage, nil
}

// getCurrentUsageFromDB gets the current month's usage from PostgreSQL (fallback)
func (m *UsageLimitMiddleware) getCurrentUsageFromDB(ctx context.Context, userID uint) (int64, error) {
	var result struct {
		TotalLogCount int64
	}

	currentMonth := models.GetCurrentMonth()

	err := m.db.WithContext(ctx).
		Table("usage_logs ul").
		Select("COALESCE(SUM(ul.log_count), 0) as total_log_count").
		Joins("JOIN projects p ON ul.project_id = p.id").
		Where("p.owner_id = ? AND ul.month = ?", userID, currentMonth).
		Scan(&result).Error

	if err != nil {
		return 0, err
	}

	return result.TotalLogCount, nil
}

// getMonthEndTimestamp returns the Unix timestamp of the end of the current month
func getMonthEndTimestamp() string {
	now := time.Now().UTC()
	firstOfNextMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	return strconv.FormatInt(firstOfNextMonth.Unix(), 10)
}

// getSecondsUntilMonthEnd returns the number of seconds until the end of the current month
func getSecondsUntilMonthEnd() int {
	now := time.Now().UTC()
	firstOfNextMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	return int(firstOfNextMonth.Sub(now).Seconds())
}

// InvalidateTierCache invalidates the cached tier for a user (call after subscription change)
func (m *UsageLimitMiddleware) InvalidateTierCache(ctx context.Context, userID uint) error {
	cacheKey := fmt.Sprintf("user:tier:%d", userID)
	return m.redis.Del(ctx, cacheKey).Err()
}
