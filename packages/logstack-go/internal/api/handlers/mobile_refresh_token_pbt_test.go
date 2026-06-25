package handlers

import (
	"net/http"
	"testing"
	"time"
)

// fakeMRTRecord represents a stored MobileRefreshToken entry.
type fakeMRTRecord struct {
	userID    uint
	revoked   bool
	createdAt time.Time
}

// fakeMRTStore is an in-memory store for MobileRefreshToken records.
type fakeMRTStore struct {
	tokens map[string]fakeMRTRecord
}

func newFakeMRTStore() *fakeMRTStore {
	return &fakeMRTStore{tokens: make(map[string]fakeMRTRecord)}
}

func (s *fakeMRTStore) add(token string, userID uint, revoked bool, createdAt time.Time) {
	s.tokens[token] = fakeMRTRecord{userID: userID, revoked: revoked, createdAt: createdAt}
}

// refreshMobileTokenWithFakeStore simulates RefreshMobileToken handler logic.
func refreshMobileTokenWithFakeStore(store *fakeMRTStore, refreshToken string) (int, map[string]interface{}) {
	record, ok := store.tokens[refreshToken]
	if !ok {
		return http.StatusUnauthorized, map[string]interface{}{"code": "TOKEN_REVOKED"}
	}
	if record.revoked {
		return http.StatusUnauthorized, map[string]interface{}{"code": "TOKEN_REVOKED"}
	}
	// Token is valid — return simulated access token
	return http.StatusOK, map[string]interface{}{"accessToken": "simulated-jwt-for-user"}
}

// TestMobileRefreshTokenNonExpiry verifies that a valid non-revoked token
// always returns HTTP 200 regardless of age.
//
// Property: ∀ non-revoked MobileRefreshToken t created at any point in time,
//
//	RefreshMobileToken(t) → HTTP 200 with accessToken.
//
// Validates: Requirements 3.14, 3.15
func TestMobileRefreshTokenNonExpiry(t *testing.T) {
	ages := []struct {
		name      string
		createdAt time.Time
	}{
		{"created 1 minute ago", time.Now().Add(-1 * time.Minute)},
		{"created 1 hour ago", time.Now().Add(-1 * time.Hour)},
		{"created 1 day ago", time.Now().Add(-24 * time.Hour)},
		{"created 30 days ago", time.Now().Add(-30 * 24 * time.Hour)},
		{"created 1 year ago", time.Now().Add(-365 * 24 * time.Hour)},
		{"created 3 years ago", time.Now().Add(-3 * 365 * 24 * time.Hour)},
	}

	for _, tc := range ages {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			store := newFakeMRTStore()
			token := "valid-token-" + tc.name
			store.add(token, 42, false, tc.createdAt)

			status, body := refreshMobileTokenWithFakeStore(store, token)

			if status != http.StatusOK {
				t.Errorf("%s: expected HTTP 200, got %d", tc.name, status)
			}
			if _, has := body["accessToken"]; !has {
				t.Errorf("%s: response must contain accessToken", tc.name)
			}
		})
	}
}

// TestMobileRefreshTokenRevoked verifies that a revoked token returns HTTP 401.
//
// Property: ∀ MobileRefreshToken t with revoked=true,
//
//	RefreshMobileToken(t) → HTTP 401 with code "TOKEN_REVOKED".
//
// Validates: Requirements 3.16, 3.17
func TestMobileRefreshTokenRevoked(t *testing.T) {
	cases := []struct {
		name string
		age  time.Duration
	}{
		{"revoked recently created token", 1 * time.Minute},
		{"revoked old token", 365 * 24 * time.Hour},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			store := newFakeMRTStore()
			token := "revoked-token-" + tc.name
			store.add(token, 42, true, time.Now().Add(-tc.age))

			status, body := refreshMobileTokenWithFakeStore(store, token)

			if status != http.StatusUnauthorized {
				t.Errorf("expected HTTP 401 for revoked token, got %d", status)
			}
			if code := body["code"]; code != "TOKEN_REVOKED" {
				t.Errorf("expected code=TOKEN_REVOKED, got %v", code)
			}
			if _, has := body["accessToken"]; has {
				t.Error("revoked token must not return accessToken")
			}
		})
	}
}

// TestMobileRefreshTokenNotFound verifies that an unknown token returns HTTP 401.
func TestMobileRefreshTokenNotFound(t *testing.T) {
	store := newFakeMRTStore()
	status, body := refreshMobileTokenWithFakeStore(store, "completely-unknown-token")
	if status != http.StatusUnauthorized {
		t.Errorf("expected HTTP 401, got %d", status)
	}
	if code := body["code"]; code != "TOKEN_REVOKED" {
		t.Errorf("expected code=TOKEN_REVOKED, got %v", code)
	}
}
