package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

// roleHierarchy maps each role name to its numeric rank.
// Higher rank means more permissions.
var roleHierarchy = map[string]int{
	"viewer": 1,
	"member": 2,
	"admin":  3,
	"owner":  4,
}

// RBACMiddleware returns a Gin handler that enforces org-level role-based access control.
// It resolves the organization ID from the ":id" URL param, looks up the caller's
// OrganizationMember record, and verifies that the caller's role rank is at least as
// high as the minimum rank among requiredRoles.
//
// Possible 403 responses:
//   - INVALID_ORG_ID   — the ":id" param is not a valid UUID
//   - NOT_A_MEMBER     — the caller has no membership record for this org
//   - INSUFFICIENT_ROLE — the caller's role rank is below the minimum required rank
//
// On success, sets "orgRole" on the gin context and calls c.Next().
func RBACMiddleware(db *gorm.DB, requiredRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.MustGet("userID").(uint)

		// Parse org ID from URL param ":id"
		orgID, err := uuid.Parse(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"code": "INVALID_ORG_ID"})
			c.Abort()
			return
		}

		// Look up the caller's membership record
		var member models.OrganizationMember
		if err := db.Where("organization_id = ? AND user_id = ?", orgID, userID).
			First(&member).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"code": "NOT_A_MEMBER"})
			c.Abort()
			return
		}

		// Determine minimum required rank from requiredRoles
		minRequiredRank := minRank(requiredRoles)

		// Check caller's actual rank
		actualRank, ok := roleHierarchy[member.Role]
		if !ok || actualRank < minRequiredRank {
			c.JSON(http.StatusForbidden, gin.H{"code": "INSUFFICIENT_ROLE"})
			c.Abort()
			return
		}

		c.Set("orgRole", member.Role)
		c.Next()
	}
}

// minRank returns the lowest rank among the given roles.
// This means passing "admin" allows both admin (rank 3) and owner (rank 4) through,
// because the minimum required rank becomes 3.
func minRank(roles []string) int {
	if len(roles) == 0 {
		return 1 // no restriction — any valid member passes
	}
	min := int(^uint(0) >> 1) // max int
	for _, r := range roles {
		if rank, ok := roleHierarchy[r]; ok {
			if rank < min {
				min = rank
			}
		}
	}
	if min == int(^uint(0)>>1) {
		return 1 // none of the supplied roles were recognized — default to open
	}
	return min
}
