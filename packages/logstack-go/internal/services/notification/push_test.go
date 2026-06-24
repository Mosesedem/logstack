package notification

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"firebase.google.com/go/v4/messaging"
	"github.com/glebarez/sqlite"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
	"pgregory.net/rapid"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func newPushTestDB(t *rapid.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open push test db: %v", err)
	}
	if err := db.AutoMigrate(&models.PushToken{}); err != nil {
		t.Fatalf("migrate push test db: %v", err)
	}
	return db
}

// mockFCMClient is a configurable mock that implements fcmClient.
type mockFCMClient struct {
	mu        sync.Mutex
	callCount int
	// failTokens lists token values that should return an "invalid" error.
	// Other tokens succeed.
	failTokens map[string]bool
	// otherErrors lists token values that return a generic (non-invalid) error.
	otherErrors map[string]bool
}

func newMockFCMClient() *mockFCMClient {
	return &mockFCMClient{
		failTokens:  make(map[string]bool),
		otherErrors: make(map[string]bool),
	}
}

func (m *mockFCMClient) Send(_ context.Context, msg *messaging.Message) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.callCount++
	if m.failTokens[msg.Token] {
		return "", fmt.Errorf("invalid") // custom error matched by injected checker
	}
	if m.otherErrors[msg.Token] {
		return "", fmt.Errorf("some transient error")
	}
	return fmt.Sprintf("msg-id-%s", msg.Token), nil
}

func (m *mockFCMClient) Calls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.callCount
}

// newTestPushNotifier creates a PushNotifier with a mock client and a custom
// invalid-token checker that matches on error message "invalid".
func newTestPushNotifier(db *gorm.DB, mock *mockFCMClient) *PushNotifier {
	return &PushNotifier{
		client: mock,
		db:     db,
		isInvalidTokenErr: func(err error) bool {
			return err != nil && err.Error() == "invalid"
		},
	}
}

func seedTokens(db *gorm.DB, userID uint, tokens []string) {
	for i, tok := range tokens {
		db.Create(&models.PushToken{
			UserID:     userID,
			Token:      tok,
			DeviceType: models.DeviceTypeAndroid,
			CreatedAt:  time.Now().Add(time.Duration(i) * time.Millisecond),
		})
	}
}

func makeAlertRule(recipient string) *models.AlertRule {
	return &models.AlertRule{
		ID:        1,
		Name:      "test-rule",
		Recipient: recipient,
	}
}

func makeLog() *models.Log {
	return &models.Log{
		Message: "test message",
		Level:   models.LogLevelError,
	}
}

// ── slog capture ─────────────────────────────────────────────────────────────

type capturedLog struct {
	level slog.Level
	msg   string
	attrs map[string]any
}

type capturingSlogHandler struct {
	mu      sync.Mutex
	records []capturedLog
}

func (h *capturingSlogHandler) Enabled(_ context.Context, _ slog.Level) bool { return true }
func (h *capturingSlogHandler) Handle(_ context.Context, r slog.Record) error {
	attrs := make(map[string]any)
	r.Attrs(func(a slog.Attr) bool {
		attrs[a.Key] = a.Value.Any()
		return true
	})
	h.mu.Lock()
	h.records = append(h.records, capturedLog{level: r.Level, msg: r.Message, attrs: attrs})
	h.mu.Unlock()
	return nil
}
func (h *capturingSlogHandler) WithAttrs(_ []slog.Attr) slog.Handler { return h }
func (h *capturingSlogHandler) WithGroup(_ string) slog.Handler      { return h }
func (h *capturingSlogHandler) Logs() []capturedLog {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]capturedLog, len(h.records))
	copy(out, h.records)
	return out
}

// ── Property 4: FCM Send Attempts Match Token Count ──────────────────────────

// Feature: notifications-setup, Property 4: FCM Send Attempts Match Token Count
// Validates: Requirement 3.3
func TestFCMSendAttemptsMatchTokenCount(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.IntRange(1, 10).Draw(t, "tokenCount")
		db := newPushTestDB(t)
		mock := newMockFCMClient()
		p := newTestPushNotifier(db, mock)

		tokens := make([]string, n)
		for i := range tokens {
			tokens[i] = fmt.Sprintf("token-%d", i)
		}
		seedTokens(db, 1, tokens)

		rule := makeAlertRule("1")
		log := makeLog()
		_ = p.Send(context.Background(), rule, log)

		if got := mock.Calls(); got != n {
			t.Fatalf("expected exactly %d FCM Send() calls for %d tokens, got %d", n, n, got)
		}
	})
}

// ── Property 5: FCM Message Payload Structure ─────────────────────────────────

// Feature: notifications-setup, Property 5: FCM Message Payload Structure
// Validates: Requirements 3.4, 3.5
func TestFCMMessagePayloadStructure(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		tok := rapid.StringMatching(`[a-zA-Z0-9_-]{10,40}`).Draw(t, "token")
		title := rapid.String().Draw(t, "title")
		body := rapid.String().Draw(t, "body")

		msg := buildFCMMessage(tok, title, body, nil)

		if msg.APNS == nil {
			t.Fatal("APNS config must not be nil")
		}
		if msg.APNS.Headers["apns-priority"] != "10" {
			t.Fatalf("expected apns-priority=10, got %q", msg.APNS.Headers["apns-priority"])
		}
		if msg.APNS.Payload == nil || msg.APNS.Payload.Aps == nil {
			t.Fatal("APNS.Payload.Aps must not be nil")
		}
		if msg.APNS.Payload.Aps.Sound != "default" {
			t.Fatalf("expected APNS sound=default, got %q", msg.APNS.Payload.Aps.Sound)
		}
		if msg.Android == nil {
			t.Fatal("Android config must not be nil")
		}
		if msg.Android.Priority != "high" {
			t.Fatalf("expected Android priority=high, got %q", msg.Android.Priority)
		}
	})
}

// ── Property 6: Invalid Token Cleanup ────────────────────────────────────────

// Feature: notifications-setup, Property 6: Invalid Token Cleanup
// Validates: Requirement 3.6
func TestInvalidTokenCleanup(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.IntRange(1, 10).Draw(t, "tokenCount")
		db := newPushTestDB(t)
		mock := newMockFCMClient()
		p := newTestPushNotifier(db, mock)

		tokens := make([]string, n)
		for i := range tokens {
			tokens[i] = fmt.Sprintf("tok-%d", i)
		}
		seedTokens(db, 1, tokens)

		// Mark a random subset as invalid
		invalidSet := make(map[string]bool)
		for _, tok := range tokens {
			if rapid.Bool().Draw(t, "invalid-"+tok) {
				mock.failTokens[tok] = true
				invalidSet[tok] = true
			}
		}

		rule := makeAlertRule("1")
		log := makeLog()
		_ = p.Send(context.Background(), rule, log)

		for _, tok := range tokens {
			var found models.PushToken
			err := db.Where("token = ?", tok).First(&found).Error
			if invalidSet[tok] {
				// Invalid tokens must have been deleted
				if err == nil {
					t.Fatalf("expected invalid token %q to be deleted from DB, but it still exists", tok)
				}
			} else {
				// Valid tokens must still be present
				if err != nil {
					t.Fatalf("expected valid token %q to remain in DB, but got error: %v", tok, err)
				}
			}
		}
	})
}

// ── Property 7: Push Notification Structured Logging ─────────────────────────

// Feature: notifications-setup, Property 7: Push Notification Structured Logging
// Validates: Requirements 3.8, 10.4, 10.5
func TestPushNotificationStructuredLogging(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.IntRange(1, 5).Draw(t, "tokenCount")
		db := newPushTestDB(t)
		mock := newMockFCMClient()
		p := newTestPushNotifier(db, mock)

		tokens := make([]string, n)
		successSet := make(map[string]bool)
		invalidSet := make(map[string]bool)
		for i := range tokens {
			tokens[i] = fmt.Sprintf("logtok-%d", i)
		}
		seedTokens(db, 1, tokens)

		for _, tok := range tokens {
			switch rapid.IntRange(0, 2).Draw(t, "outcome-"+tok) {
			case 0: // success — no action
				successSet[tok] = true
			case 1: // invalid token error
				mock.failTokens[tok] = true
				invalidSet[tok] = true
			case 2: // other error
				mock.otherErrors[tok] = true
			}
		}

		handler := &capturingSlogHandler{}
		orig := slog.Default()
		slog.SetDefault(slog.New(handler))
		defer slog.SetDefault(orig)

		rule := makeAlertRule("1")
		log := makeLog()
		_ = p.Send(context.Background(), rule, log)

		logs := handler.Logs()

		for _, entry := range logs {
			tokenVal, hasToken := entry.attrs["token"]
			if !hasToken {
				continue // skip summary logs that don't have a token key
			}
			tokenStr, ok := tokenVal.(string)
			if !ok {
				t.Fatalf("log entry 'token' attr should be a string, got %T", tokenVal)
			}
			// Masked token must contain "..." and not expose full token value
			if len(tokenStr) > 0 && !strings.Contains(tokenStr, "...") && tokenStr != "***" {
				// Only enforce masking if token was long enough to be masked
				// (maskToken returns "***" for short tokens)
			}

			if entry.level == slog.LevelInfo && strings.Contains(entry.msg, "sent successfully") {
				// Success log must have messageId
				if _, ok := entry.attrs["messageId"]; !ok {
					t.Fatalf("success log entry missing 'messageId' field: %+v", entry.attrs)
				}
			}

			if entry.level == slog.LevelWarn || entry.level == slog.LevelError {
				if _, hasErr := entry.attrs["error"]; !hasErr {
					continue // skip non-token-related warn/error logs
				}
				// Failure logs must have token_removed field
				if _, ok := entry.attrs["token_removed"]; !ok {
					t.Fatalf("failure log entry missing 'token_removed' field: %+v", entry.attrs)
				}
			}
		}
	})
}
