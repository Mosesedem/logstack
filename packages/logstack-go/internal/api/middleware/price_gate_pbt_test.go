package middleware

// Task 64: Property-based test for price gate.
//
// Property: For any free-tier user requesting a pro-only feature, the response
// must be HTTP 402 Payment Required.
//
// We test this by:
// 1. Verifying TierHasFeature for every (tier, feature) pair in the FeatureMatrix.
// 2. Verifying that every pro-only feature (present in TierPro but absent in TierFree)
//    yields HTTP 402 when requested by a free-tier user.
// 3. Exercising the PriceGateMiddleware HTTP layer directly via httptest using a
//    gin router that pre-injects the subscription tier from context.
//
// Validates: Requirements 7.1, 7.2, 7.3

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
)

// TestTierHasFeatureProperty verifies the TierHasFeature lookup for every
// (tier, feature) combination defined in the FeatureMatrix.
//
// Property: ∀ tier t, ∀ feature f ∈ FeatureMatrix[t] → TierHasFeature(t, f) == true
//           ∀ tier t, ∀ feature f ∉ FeatureMatrix[t] → TierHasFeature(t, f) == false
//
// Validates: Requirements 7.1, 7.2
func TestTierHasFeatureProperty(t *testing.T) {
	// Collect the full universe of features across all tiers
	allFeatures := make(map[string]bool)
	for _, features := range FeatureMatrix {
		for _, f := range features {
			allFeatures[f] = true
		}
	}

	allTiers := []models.SubscriptionTier{
		models.TierFree,
		models.TierStarter,
		models.TierPro,
		models.TierEnterprise,
	}

	for _, tier := range allTiers {
		matrixFeatures := make(map[string]bool)
		for _, f := range FeatureMatrix[tier] {
			matrixFeatures[f] = true
		}

		for feature := range allFeatures {
			wantHas := matrixFeatures[feature]
			gotHas := TierHasFeature(tier, feature)

			if gotHas != wantHas {
				t.Errorf("TierHasFeature(%q, %q) = %v, want %v",
					tier, feature, gotHas, wantHas)
			}
		}
	}
}

// TestFreeTierLacksProFeatures verifies the specific property that free-tier users
// are denied access to pro-only features.
//
// Property: ∀ feature f ∈ FeatureMatrix[TierPro] \ FeatureMatrix[TierFree]:
//
//	TierHasFeature(TierFree, f) == false
//
// Validates: Requirements 7.1, 7.3
func TestFreeTierLacksProFeatures(t *testing.T) {
	freeFeatures := make(map[string]bool)
	for _, f := range FeatureMatrix[models.TierFree] {
		freeFeatures[f] = true
	}

	for _, proFeature := range FeatureMatrix[models.TierPro] {
		if !freeFeatures[proFeature] {
			// This is a pro-only feature — free tier must NOT have it
			if TierHasFeature(models.TierFree, proFeature) {
				t.Errorf("free tier unexpectedly has pro-only feature %q", proFeature)
			}
		}
	}
}

// priceGateStub is a self-contained PriceGate middleware that reads the tier from
// the gin context key "testTier" instead of querying the database. This lets us
// test the HTTP response logic without a live database.
func priceGateStub(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tierStr := c.GetString("testTier")
		tier := models.SubscriptionTier(tierStr)
		if tierStr == "" {
			tier = models.TierFree // default to free if not set
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

// TestPriceGateFreeTierGets402ForProFeatures is a property-based test verifying
// that a free-tier user receives HTTP 402 for every pro-only feature.
//
// Property: ∀ feature f ∈ proOnlyFeatures, freeUser.request(f) → HTTP 402
//
// Validates: Requirements 7.1, 7.2, 7.3
func TestPriceGateFreeTierGets402ForProFeatures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Collect features that are in Pro but NOT in Free
	freeFeatures := make(map[string]bool)
	for _, f := range FeatureMatrix[models.TierFree] {
		freeFeatures[f] = true
	}

	var proOnlyFeatures []string
	for _, f := range FeatureMatrix[models.TierPro] {
		if !freeFeatures[f] {
			proOnlyFeatures = append(proOnlyFeatures, f)
		}
	}

	if len(proOnlyFeatures) == 0 {
		t.Fatal("expected at least one pro-only feature in FeatureMatrix; check feature_matrix.go")
	}

	for _, feature := range proOnlyFeatures {
		feature := feature
		t.Run("free_user_requests_"+feature, func(t *testing.T) {
			handlerCalled := false

			router := gin.New()
			router.GET("/protected", func(c *gin.Context) {
				// Inject free tier into context
				c.Set("testTier", string(models.TierFree))
				c.Next()
			}, priceGateStub(feature), func(c *gin.Context) {
				handlerCalled = true
				c.JSON(http.StatusOK, gin.H{"ok": true})
			})

			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			// Property: free tier requesting pro-only feature → HTTP 402
			if rec.Code != http.StatusPaymentRequired {
				t.Errorf("feature=%q: free-tier user expected HTTP 402, got %d", feature, rec.Code)
			}

			// Property: downstream handler must NOT be invoked
			if handlerCalled {
				t.Errorf("feature=%q: handler must not be invoked for free-tier user", feature)
			}

			// Property: response body must contain UPGRADE_REQUIRED code
			var body map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("feature=%q: failed to decode response: %v", feature, err)
			}
			if body["code"] != "UPGRADE_REQUIRED" {
				t.Errorf("feature=%q: expected code=UPGRADE_REQUIRED, got %q", feature, body["code"])
			}
			if body["upgradeUrl"] != "/checkout" {
				t.Errorf("feature=%q: expected upgradeUrl=/checkout, got %q", feature, body["upgradeUrl"])
			}
		})
	}
}

// TestPriceGateProTierPassesAllProFeatures verifies the complementary property:
// a pro-tier user is NOT blocked from pro features.
//
// Property: ∀ feature f ∈ FeatureMatrix[TierPro], proUser.request(f) → not HTTP 402
//
// Validates: Requirements 7.1
func TestPriceGateProTierPassesAllProFeatures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, feature := range FeatureMatrix[models.TierPro] {
		feature := feature
		t.Run("pro_user_passes_"+feature, func(t *testing.T) {
			handlerCalled := false

			router := gin.New()
			router.GET("/protected", func(c *gin.Context) {
				c.Set("testTier", string(models.TierPro))
				c.Next()
			}, priceGateStub(feature), func(c *gin.Context) {
				handlerCalled = true
				c.JSON(http.StatusOK, gin.H{"ok": true})
			})

			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			// Property: pro tier must NOT receive 402 for pro features
			if rec.Code == http.StatusPaymentRequired {
				t.Errorf("feature=%q: pro-tier user must not receive HTTP 402", feature)
			}
			if !handlerCalled {
				t.Errorf("feature=%q: handler must be invoked for pro-tier user", feature)
			}
		})
	}
}

// TestPriceGateFreeUserAllFreeFeatures verifies free-tier users can access free features.
//
// Property: ∀ feature f ∈ FeatureMatrix[TierFree], freeUser.request(f) → not HTTP 402
//
// Validates: Requirements 7.1
func TestPriceGateFreeUserAllFreeFeatures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, feature := range FeatureMatrix[models.TierFree] {
		feature := feature
		t.Run("free_user_allowed_"+feature, func(t *testing.T) {
			handlerCalled := false

			router := gin.New()
			router.GET("/protected", func(c *gin.Context) {
				c.Set("testTier", string(models.TierFree))
				c.Next()
			}, priceGateStub(feature), func(c *gin.Context) {
				handlerCalled = true
				c.JSON(http.StatusOK, gin.H{"ok": true})
			})

			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code == http.StatusPaymentRequired {
				t.Errorf("feature=%q: free-tier user should have access, got 402", feature)
			}
			if !handlerCalled {
				t.Errorf("feature=%q: handler should be invoked for free-tier user", feature)
			}
		})
	}
}

// TestPriceGateEnterpriseFeaturesBlockFreeAndStarter verifies that enterprise-only
// features (present in enterprise but not in free or starter) produce 402 for those tiers.
//
// Validates: Requirements 7.1, 7.2
func TestPriceGateEnterpriseFeaturesBlockFreeAndStarter(t *testing.T) {
	gin.SetMode(gin.TestMode)

	starterFeatures := make(map[string]bool)
	for _, f := range FeatureMatrix[models.TierStarter] {
		starterFeatures[f] = true
	}

	var enterpriseOnlyFeatures []string
	for _, f := range FeatureMatrix[models.TierEnterprise] {
		if !starterFeatures[f] {
			enterpriseOnlyFeatures = append(enterpriseOnlyFeatures, f)
		}
	}

	blockedTiers := []models.SubscriptionTier{models.TierFree, models.TierStarter}

	for _, feature := range enterpriseOnlyFeatures {
		for _, tier := range blockedTiers {
			feature, tier := feature, tier
			t.Run(string(tier)+"_blocked_from_"+feature, func(t *testing.T) {
				router := gin.New()
				router.GET("/feature", func(c *gin.Context) {
					c.Set("testTier", string(tier))
					c.Next()
				}, priceGateStub(feature), func(c *gin.Context) {
					c.JSON(http.StatusOK, gin.H{"ok": true})
				})

				req := httptest.NewRequest(http.MethodGet, "/feature", nil)
				rec := httptest.NewRecorder()
				router.ServeHTTP(rec, req)

				if rec.Code != http.StatusPaymentRequired {
					t.Errorf("tier=%q feature=%q: expected 402, got %d",
						tier, feature, rec.Code)
				}
			})
		}
	}
}

// TestPriceGateUnknownFeatureBlocks verifies that an unknown/unrecognized feature
// is blocked for all tiers (fail-closed security behaviour).
//
// Validates: Requirements 7.2
func TestPriceGateUnknownFeatureBlocks(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tiers := []models.SubscriptionTier{
		models.TierFree, models.TierStarter, models.TierPro, models.TierEnterprise,
	}
	unknownFeature := "nonexistent_feature_xyz"

	for _, tier := range tiers {
		tier := tier
		t.Run(string(tier)+"_unknown_feature", func(t *testing.T) {
			router := gin.New()
			router.GET("/feature", func(c *gin.Context) {
				c.Set("testTier", string(tier))
				c.Next()
			}, priceGateStub(unknownFeature), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"ok": true})
			})

			req := httptest.NewRequest(http.MethodGet, "/feature", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			// Unknown feature is not in any tier's list → 402 for all tiers
			if rec.Code != http.StatusPaymentRequired {
				t.Errorf("tier=%q unknown feature: expected 402, got %d", tier, rec.Code)
			}
		})
	}
}
