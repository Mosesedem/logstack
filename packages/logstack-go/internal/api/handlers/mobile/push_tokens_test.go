package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
	"pgregory.net/rapid"
)

func setupTokenCapTestDB(t *rapid.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := db.AutoMigrate(&models.PushToken{}); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}
	return db
}

func callRegisterToken(t *rapid.T, h *MobileHandler, userID uint, token string) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(models.PushTokenCreateRequest{
		Token:      token,
		DeviceType: models.DeviceTypeAndroid,
	})
	req := httptest.NewRequest(http.MethodPost, "/mobile/push-token", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("userID", userID)
	h.RegisterPushToken(c)
}

// Feature: notifications-setup, Property 3: Push Token Cap Invariant
// Validates: Requirement 2.6
func TestPushTokenCapInvariant(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		db := setupTokenCapTestDB(t)
		h := &MobileHandler{db: db}
		const userID uint = 1

		n := rapid.IntRange(1, 20).Draw(t, "n")

		for i := 0; i < n; i++ {
			token := fmt.Sprintf("token-%d", i)

			// Before registering: record oldest if we're at cap
			var countBefore int64
			db.Model(&models.PushToken{}).Where("user_id = ?", userID).Count(&countBefore)

			var oldestTokenBefore string
			if countBefore >= 10 {
				var oldest models.PushToken
				if err := db.Where("user_id = ?", userID).Order("updated_at ASC, created_at ASC").First(&oldest).Error; err == nil {
					oldestTokenBefore = oldest.Token
				}
			}

			time.Sleep(time.Millisecond) // ensure distinct created_at in SQLite

			callRegisterToken(t, h, userID, token)

			// Assert cap invariant: count must not exceed 10
			var countAfter int64
			db.Model(&models.PushToken{}).Where("user_id = ?", userID).Count(&countAfter)
			if countAfter > 10 {
				t.Fatalf("token count %d exceeds cap of 10 after inserting token %q", countAfter, token)
			}

			// Assert least-recently-updated was evicted when cap was triggered
			if countBefore >= 10 && oldestTokenBefore != "" {
				var evicted models.PushToken
				result := db.Where("user_id = ? AND token = ?", userID, oldestTokenBefore).First(&evicted)
				if result.Error == nil {
					t.Fatalf("expected oldest token %q to be evicted but it still exists in DB", oldestTokenBefore)
				}
			}

			// Newest registration must remain (multi-device; no per-platform purge)
			var newest models.PushToken
			if err := db.Where("user_id = ? AND token = ?", userID, token).First(&newest).Error; err != nil {
				t.Fatalf("expected newly registered token %q to exist: %v", token, err)
			}
		}

		// After many same-platform registrations, multiple tokens should coexist (up to cap)
		var finalCount int64
		db.Model(&models.PushToken{}).Where("user_id = ?", userID).Count(&finalCount)
		expected := n
		if expected > 10 {
			expected = 10
		}
		if int(finalCount) != expected {
			t.Fatalf("expected %d tokens after multi-device register, got %d", expected, finalCount)
		}
	})
}
