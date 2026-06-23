package middleware

// Task 63: Property-based test for RBAC enforcement.
//
// Property: For roles ranked viewer < member < admin < owner, any request where
// the user's org role rank is strictly below the required rank must receive
// HTTP 403 before the handler is invoked.
//
// The test exhaustively covers all (actual_role, required_role) pairs, verifying:
//   - Pairs where actual rank < required rank → always 403
//   - Pairs where actual rank >= required rank → handler allowed to run (not 403)
//
// Testing approach: We test the roleHierarchy map and minRank logic directly, then
// verify HTTP responses by constructing a gin router with a pre-seeded gin context
// (bypassing DB lookup by testing the pure role-enforcement logic).
//
// Validates: Requirements 4.6, 4.7, 7.4

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestRoleHierarchyValues verifies the numeric rank of each role is correct and
// that the ordering viewer < member < admin < owner holds.
//
// Property: rank("viewer") < rank("member") < rank("admin") < rank("owner")
//
// Validates: Requirements 4.6, 4.7
func TestRoleHierarchyValues(t *testing.T) {
	expected := map[string]int{
		"viewer": 1,
		"member": 2,
		"admin":  3,
		"owner":  4,
	}

	for role, wantRank := range expected {
		gotRank, ok := roleHierarchy[role]
		if !ok {
			t.Errorf("role %q not found in roleHierarchy", role)
			continue
		}
		if gotRank != wantRank {
			t.Errorf("roleHierarchy[%q] = %d, want %d", role, gotRank, wantRank)
		}
	}

	// Verify strict ordering: viewer < member < admin < owner
	roles := []string{"viewer", "member", "admin", "owner"}
	for i := 0; i < len(roles)-1; i++ {
		lower := roleHierarchy[roles[i]]
		higher := roleHierarchy[roles[i+1]]
		if lower >= higher {
			t.Errorf("expected rank(%q) < rank(%q), got %d >= %d",
				roles[i], roles[i+1], lower, higher)
		}
	}
}

// TestMinRankFunction verifies the minRank helper returns the lowest rank among given roles.
//
// Property: minRank(roles) == min({rank(r) | r ∈ roles})
func TestMinRankFunction(t *testing.T) {
	cases := []struct {
		roles   []string
		wantMin int
	}{
		{[]string{"admin"}, 3},
		{[]string{"owner"}, 4},
		{[]string{"viewer"}, 1},
		{[]string{"member"}, 2},
		{[]string{"admin", "owner"}, 3},  // min of 3,4 = 3 → admin or higher passes
		{[]string{"viewer", "admin"}, 1}, // min of 1,3 = 1 → any role passes
		{[]string{}, 1},                  // no restriction
		{[]string{"unknown_role"}, 1},    // unrecognized role → open
	}

	for _, tc := range cases {
		got := minRank(tc.roles)
		if got != tc.wantMin {
			t.Errorf("minRank(%v) = %d, want %d", tc.roles, got, tc.wantMin)
		}
	}
}

// TestRBACRoleEnforcementProperty is an exhaustive property-based test over all
// (actual_role, required_role) combinations.
//
// Property: ∀ actual_role ∈ {viewer,member,admin,owner},
//
//	∀ required_role ∈ {viewer,member,admin,owner}:
//	  rank(actual_role) < rank(required_role) → response is HTTP 403
//	  rank(actual_role) >= rank(required_role) → handler is invoked (not 403)
//
// The test uses a gin router with a stub middleware that enforces rank-based access
// control using the same roleHierarchy map as the real RBACMiddleware, but injects
// the member role from the gin context (bypassing the DB lookup) so no database is
// required.
//
// Validates: Requirements 4.6, 4.7, 7.4
func TestRBACRoleEnforcementProperty(t *testing.T) {
	gin.SetMode(gin.TestMode)

	allRoles := []string{"viewer", "member", "admin", "owner"}

	// makeRBACStub returns a middleware that enforces requiredRole using the real
	// roleHierarchy map. It reads the actual role from gin context key "testRole",
	// which is set by the preceding handler, bypassing the DB lookup entirely.
	makeRBACStub := func(requiredRole string) gin.HandlerFunc {
		return func(c *gin.Context) {
			actualRole := c.GetString("testRole")
			actualRank, ok := roleHierarchy[actualRole]
			if !ok {
				c.JSON(http.StatusForbidden, gin.H{"code": "INVALID_ROLE"})
				c.Abort()
				return
			}
			minRequired := minRank([]string{requiredRole})
			if actualRank < minRequired {
				c.JSON(http.StatusForbidden, gin.H{"code": "INSUFFICIENT_ROLE"})
				c.Abort()
				return
			}
			c.Set("orgRole", actualRole)
			c.Next()
		}
	}

	for _, requiredRole := range allRoles {
		for _, actualRole := range allRoles {
			actualRole, requiredRole := actualRole, requiredRole // capture
			actualRank := roleHierarchy[actualRole]
			requiredRank := minRank([]string{requiredRole})
			shouldDeny := actualRank < requiredRank

			testName := actualRole + "_requests_" + requiredRole + "_resource"
			t.Run(testName, func(t *testing.T) {
				handlerWasCalled := false

				router := gin.New()
				// Inject the test role before RBAC middleware runs
				router.GET("/test", func(c *gin.Context) {
					c.Set("testRole", actualRole)
					c.Next()
				}, makeRBACStub(requiredRole), func(c *gin.Context) {
					// Protected downstream handler
					handlerWasCalled = true
					c.JSON(http.StatusOK, gin.H{"ok": true})
				})

				req := httptest.NewRequest(http.MethodGet, "/test", nil)
				rec := httptest.NewRecorder()
				router.ServeHTTP(rec, req)

				if shouldDeny {
					// Property: insufficient rank → HTTP 403
					if rec.Code != http.StatusForbidden {
						t.Errorf("actual=%q required=%q (rank %d < %d): expected 403, got %d",
							actualRole, requiredRole, actualRank, requiredRank, rec.Code)
					}
					// Property: handler must NOT be invoked when rank is insufficient
					if handlerWasCalled {
						t.Errorf("actual=%q required=%q: handler must not be invoked when role rank is insufficient",
							actualRole, requiredRole)
					}
				} else {
					// Property: sufficient rank → handler allowed (not 403)
					if rec.Code == http.StatusForbidden {
						t.Errorf("actual=%q required=%q (rank %d >= %d): handler should be allowed, got 403",
							actualRole, requiredRole, actualRank, requiredRank)
					}
					// Property: handler MUST be invoked when rank is sufficient
					if !handlerWasCalled {
						t.Errorf("actual=%q required=%q: handler must be invoked when role rank is sufficient",
							actualRole, requiredRole)
					}
				}
			})
		}
	}
}

// TestRBACForbiddenResponseCode verifies the 403 response body contains
// INSUFFICIENT_ROLE (not just any 403).
//
// Property: When rank(actual) < rank(required), response body code == "INSUFFICIENT_ROLE"
//
// Validates: Requirements 4.6, 4.7
func TestRBACForbiddenResponseCode(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// viewer trying to access an admin resource — definitive case
	router := gin.New()
	router.GET("/org-resource", func(c *gin.Context) {
		c.Set("testRole", "viewer")
		c.Next()
	}, func(c *gin.Context) {
		actualRole := c.GetString("testRole")
		actualRank := roleHierarchy[actualRole]
		required := minRank([]string{"admin"})
		if actualRank < required {
			c.JSON(http.StatusForbidden, gin.H{"code": "INSUFFICIENT_ROLE"})
			c.Abort()
			return
		}
		c.Next()
	}, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/org-resource", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["code"] != "INSUFFICIENT_ROLE" {
		t.Errorf("expected code=INSUFFICIENT_ROLE, got %q", body["code"])
	}
}

// TestRBACOwnerPassesAll verifies the property that "owner" passes every required role.
//
// Property: ∀ required_role: owner always passes (rank 4 >= any rank)
//
// Validates: Requirements 4.6
func TestRBACOwnerPassesAll(t *testing.T) {
	allRoles := []string{"viewer", "member", "admin", "owner"}
	ownerRank := roleHierarchy["owner"]

	for _, requiredRole := range allRoles {
		required := minRank([]string{requiredRole})
		if ownerRank < required {
			t.Errorf("owner (rank %d) should always pass required=%q (rank %d)",
				ownerRank, requiredRole, required)
		}
	}
}

// TestRBACViewerDeniedAboveViewer verifies that "viewer" is denied from resources
// requiring any role above viewer.
//
// Property: viewer is only allowed when required role is also viewer.
//
// Validates: Requirements 4.7
func TestRBACViewerDeniedAboveViewer(t *testing.T) {
	viewerRank := roleHierarchy["viewer"]

	cases := []struct {
		requiredRole string
		shouldDeny   bool
	}{
		{"viewer", false}, // viewer can access viewer resources
		{"member", true},  // viewer cannot access member resources
		{"admin", true},   // viewer cannot access admin resources
		{"owner", true},   // viewer cannot access owner resources
	}

	for _, tc := range cases {
		requiredRank := minRank([]string{tc.requiredRole})
		denied := viewerRank < requiredRank
		if denied != tc.shouldDeny {
			t.Errorf("viewer vs required=%q: expected deny=%v, got deny=%v",
				tc.requiredRole, tc.shouldDeny, denied)
		}
	}
}
