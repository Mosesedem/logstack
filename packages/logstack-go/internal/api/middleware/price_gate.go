package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// PriceGateMiddleware returns a Gin handler that enforces feature-level access control
// based on the authenticated user's subscription tier.
//
// If the user's tier does not include the requested feature, it aborts with HTTP 402
// and an UPGRADE_REQUIRED error response. If no subscription record is found, the user
// is treated as TierFree.
func PriceGateMiddleware(db *gorm.DB, feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.MustGet("userID").(uint)

		var sub models.Subscription
		tier := models.TierFree
		if err := db.Where("user_id = ?", userID).First(&sub).Error; err == nil {
			tier = sub.Tier
		}

		if !TierHasFeature(tier, feature) {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"code":       "UPGRADE_REQUIRED",
				"message":    "This feature requires a higher subscription tier.",
				"upgradeUrl": "/checkout",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
