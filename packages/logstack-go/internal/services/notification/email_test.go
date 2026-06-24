package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"pgregory.net/rapid"
)

// ── mock provider ─────────────────────────────────────────────────────────────

// mockProvider is a configurable EmailProvider for property-based tests.
type mockProvider struct {
	name       string
	configured bool
	shouldFail bool
	callCount  int
	order      *[]string // shared pointer to record call order across providers
}

func (m *mockProvider) Name() string { return m.name }

func (m *mockProvider) IsConfigured() bool { return m.configured }

func (m *mockProvider) Send(_ context.Context, _, _, _, _ string) error {
	if m.order != nil {
		*m.order = append(*m.order, m.name)
	}
	m.callCount++
	if m.shouldFail {
		return fmt.Errorf("%s error", m.name)
	}
	return nil
}

// ── test notifier constructor ─────────────────────────────────────────────────

// newTestEmailNotifier constructs an EmailNotifier bypassing NewEmailNotifier
// so tests can inject arbitrary provider slices.
func newTestEmailNotifier(providers []EmailProvider) *EmailNotifier {
	return &EmailNotifier{providers: providers, baseURL: "https://test.example.com"}
}

// ── slog capture (email tests) ────────────────────────────────────────────────

// capturingEmailSlogHandler is a separate capturing handler to avoid collision
// with capturingSlogHandler defined in push_test.go.
type capturingEmailSlogHandler struct {
	mu      sync.Mutex
	records []capturedLog
}

func (h *capturingEmailSlogHandler) Enabled(_ context.Context, _ slog.Level) bool { return true }

func (h *capturingEmailSlogHandler) Handle(_ context.Context, r slog.Record) error {
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

func (h *capturingEmailSlogHandler) WithAttrs(_ []slog.Attr) slog.Handler { return h }
func (h *capturingEmailSlogHandler) WithGroup(_ string) slog.Handler      { return h }

func (h *capturingEmailSlogHandler) Logs() []capturedLog {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]capturedLog, len(h.records))
	copy(out, h.records)
	return out
}

// ── Property 8: Email Provider Chain Ordering and Failover ───────────────────

// Feature: notifications-setup, Property 8: Email Provider Chain Ordering and Failover
// Validates: Requirements 4.1, 4.2
func TestEmailChainOrdering(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Generate which providers fail (all configured)
		p0fails := rapid.Bool().Draw(t, "p0fails")
		p1fails := rapid.Bool().Draw(t, "p1fails")
		p2fails := rapid.Bool().Draw(t, "p2fails")
		p3fails := rapid.Bool().Draw(t, "p3fails")

		callOrder := make([]string, 0, 4)
		providers := []EmailProvider{
			&mockProvider{name: "Mailcow", configured: true, shouldFail: p0fails, order: &callOrder},
			&mockProvider{name: "Brevo", configured: true, shouldFail: p1fails, order: &callOrder},
			&mockProvider{name: "Resend", configured: true, shouldFail: p2fails, order: &callOrder},
			&mockProvider{name: "Zoho", configured: true, shouldFail: p3fails, order: &callOrder},
		}
		e := newTestEmailNotifier(providers)
		_ = e.sendEmail(context.Background(), "to@example.com", "To", "subj", "<p>body</p>")

		// Assert ordering: each provider in callOrder must appear in increasing index
		expectedOrder := []string{"Mailcow", "Brevo", "Resend", "Zoho"}
		pos := 0
		for _, called := range callOrder {
			for pos < len(expectedOrder) && expectedOrder[pos] != called {
				pos++
			}
			if pos >= len(expectedOrder) {
				t.Fatalf("provider %q called out of expected order; callOrder=%v", called, callOrder)
			}
		}

		// A failed provider N must always trigger N+1 (if configured and chain not yet succeeded).
		// Verify that if callOrder[i] succeeded, there is no callOrder[i+1].
		for i := 0; i < len(callOrder)-1; i++ {
			for _, p := range providers {
				mp := p.(*mockProvider)
				if mp.name == callOrder[i] && !mp.shouldFail {
					// This provider succeeded — the chain should have stopped here.
					t.Fatalf("provider %q succeeded but chain continued to %q; callOrder=%v",
						callOrder[i], callOrder[i+1], callOrder)
				}
			}
		}
	})
}

// ── Property 9: Provider Success Short-Circuits the Chain ────────────────────

// Feature: notifications-setup, Property 9: Provider Success Short-Circuits the Chain
// Validates: Requirements 4.3, 4.4
func TestProviderSuccessShortCircuits(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// successIdx is the first provider index that succeeds; all before it fail.
		successIdx := rapid.IntRange(0, 3).Draw(t, "successIdx")

		callOrder := make([]string, 0, 4)
		names := []string{"Mailcow", "Brevo", "Resend", "Zoho"}
		providers := make([]EmailProvider, 4)
		for i, name := range names {
			fails := i < successIdx // providers before successIdx fail
			providers[i] = &mockProvider{name: name, configured: true, shouldFail: fails, order: &callOrder}
		}
		e := newTestEmailNotifier(providers)
		err := e.sendEmail(context.Background(), "to@example.com", "To", "subj", "<p>body</p>")

		if err != nil {
			t.Fatalf("expected success (provider %d succeeds), got error: %v", successIdx, err)
		}

		// Providers after successIdx must never be called.
		for i := successIdx + 1; i < 4; i++ {
			if providers[i].(*mockProvider).callCount > 0 {
				t.Fatalf("provider %q (idx %d) was called after provider %q (idx %d) succeeded; callOrder=%v",
					names[i], i, names[successIdx], successIdx, callOrder)
			}
		}
	})
}

// ── Property 10: Combined Error on Total Failure ──────────────────────────────

// Feature: notifications-setup, Property 10: Combined Error on Total Failure
// Validates: Requirement 4.5
func TestCombinedErrorOnTotalFailure(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		names := []string{"Mailcow", "Brevo", "Resend", "Zoho"}
		providers := make([]EmailProvider, len(names))
		for i, name := range names {
			providers[i] = &mockProvider{name: name, configured: true, shouldFail: true}
		}
		e := newTestEmailNotifier(providers)
		err := e.sendEmail(context.Background(), "to@example.com", "To", "subj", "<p>body</p>")

		if err == nil {
			t.Fatal("expected error when all providers fail, got nil")
		}
		errStr := err.Error()
		for _, name := range names {
			if !strings.Contains(errStr, name) {
				t.Fatalf("combined error missing provider %q: %q", name, errStr)
			}
		}
	})
}

// ── Property 11: Only Configured Providers Are Attempted ─────────────────────

// Feature: notifications-setup, Property 11: Only Configured Providers Are Attempted
// Validates: Requirement 4.6
func TestOnlyConfiguredProvidersAttempted(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		configs := [4]bool{
			rapid.Bool().Draw(t, "c0"),
			rapid.Bool().Draw(t, "c1"),
			rapid.Bool().Draw(t, "c2"),
			rapid.Bool().Draw(t, "c3"),
		}
		names := []string{"Mailcow", "Brevo", "Resend", "Zoho"}
		providers := make([]EmailProvider, 4)
		for i, name := range names {
			providers[i] = &mockProvider{name: name, configured: configs[i], shouldFail: true}
		}
		e := newTestEmailNotifier(providers)
		_ = e.sendEmail(context.Background(), "to@example.com", "To", "subj", "<p>body</p>")

		for i, p := range providers {
			mp := p.(*mockProvider)
			if configs[i] && mp.callCount == 0 {
				t.Fatalf("configured provider %q was not attempted", mp.name)
			}
			if !configs[i] && mp.callCount > 0 {
				t.Fatalf("unconfigured provider %q was attempted", mp.name)
			}
		}
	})
}

// ── Property 12: No-Provider Send Returns Error Without Network I/O ───────────

// Feature: notifications-setup, Property 12: No-Provider Send Returns Error Without Network I/O
// Validates: Requirement 4.8
func TestNoProviderSendReturnsErrorWithoutNetworkIO(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		providers := []EmailProvider{
			&mockProvider{name: "Mailcow", configured: false, shouldFail: false},
			&mockProvider{name: "Brevo", configured: false, shouldFail: false},
			&mockProvider{name: "Resend", configured: false, shouldFail: false},
			&mockProvider{name: "Zoho", configured: false, shouldFail: false},
		}
		e := newTestEmailNotifier(providers)
		err := e.sendEmail(context.Background(), "to@example.com", "To", "subj", "<p>body</p>")

		if err == nil {
			t.Fatal("expected error when no providers configured, got nil")
		}
		// No Send() calls should have been made (no network I/O).
		for _, p := range providers {
			if p.(*mockProvider).callCount > 0 {
				t.Fatalf("provider %q was called despite being unconfigured", p.(*mockProvider).name)
			}
		}
	})
}

// ── rewritingTransport rewrites outbound requests to a test server host ───────

type rewritingTransport struct {
	base       http.RoundTripper
	targetHost string
}

func (rt *rewritingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	cloned := req.Clone(req.Context())
	parsedTarget, _ := url.Parse(rt.targetHost)
	cloned.URL.Scheme = parsedTarget.Scheme
	cloned.URL.Host = parsedTarget.Host
	base := rt.base
	if base == nil {
		base = http.DefaultTransport
	}
	return base.RoundTrip(cloned)
}

// ── Property 13: Zoho OAuth Token Obtained Before Send ───────────────────────

// Feature: notifications-setup, Property 13: Zoho OAuth Token Obtained Before Send
// Validates: Requirements 8.1, 8.2
// This tests the ordering contract by checking that the Zoho token endpoint is
// called before the messages endpoint using a test HTTP server.
func TestZohoOAuthTokenObtainedBeforeSend(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Generate arbitrary recipient addresses.
		toAddr := rapid.StringMatching(`[a-z]{3,8}@example\.com`).Draw(t, "to")

		var callLog []string
		var mu sync.Mutex

		// Spin up a test server acting as both Zoho token + mail endpoints.
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			callLog = append(callLog, r.URL.Path)
			mu.Unlock()

			switch r.URL.Path {
			case "/oauth/v2/token":
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(zohoTokenResponse{
					AccessToken: "test-token",
					TokenType:   "Bearer",
				})
			case "/api/accounts":
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(zohoAccountsResponse{
					Status: struct {
						Code int `json:"code"`
					}{Code: 200},
					Data: []struct {
						AccountID string `json:"accountId"`
					}{{AccountID: "acct-1"}},
				})
			case "/api/accounts/acct-1/messages":
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(zohoSendResponse{
					Status: struct {
						Code int `json:"code"`
					}{Code: 200},
				})
			default:
				w.WriteHeader(http.StatusNotFound)
			}
		}))
		defer srv.Close()

		// Build a zohoProvider that redirects all requests to the test server.
		p := &zohoProvider{
			clientID:     "cid",
			clientSecret: "csec",
			refreshToken: "rtoken",
			client: &http.Client{
				Timeout: 5 * time.Second,
				Transport: &rewritingTransport{
					targetHost: srv.URL,
				},
			},
		}

		err := p.Send(context.Background(), toAddr, "Test User", "Test Subject", "<p>hello</p>")
		if err != nil {
			t.Fatalf("expected Zoho send to succeed, got: %v", err)
		}

		mu.Lock()
		log := append([]string(nil), callLog...)
		mu.Unlock()

		// Token endpoint must appear before the messages endpoint.
		tokenIdx := -1
		messagesIdx := -1
		for i, path := range log {
			if path == "/oauth/v2/token" && tokenIdx < 0 {
				tokenIdx = i
			}
			if strings.Contains(path, "/messages") && messagesIdx < 0 {
				messagesIdx = i
			}
		}
		if tokenIdx < 0 {
			t.Fatalf("Zoho OAuth token endpoint was never called; log=%v", log)
		}
		if messagesIdx < 0 {
			t.Fatalf("Zoho messages endpoint was never called; log=%v", log)
		}
		if tokenIdx >= messagesIdx {
			t.Fatalf("token endpoint (idx %d) must be called before messages endpoint (idx %d); log=%v",
				tokenIdx, messagesIdx, log)
		}
	})
}

// ── Property 14: Email Provider Attempt Structured Logging ───────────────────

// Feature: notifications-setup, Property 14: Email Provider Attempt Structured Logging
// Validates: Requirements 10.1, 10.2, 10.3
func TestEmailProviderAttemptStructuredLogging(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// successIdx == -1 means all providers fail; 0..3 means that index succeeds.
		successIdx := rapid.IntRange(-1, 3).Draw(t, "successIdx")

		names := []string{"Mailcow", "Brevo", "Resend", "Zoho"}
		providers := make([]EmailProvider, 4)
		for i, name := range names {
			shouldFail := successIdx < 0 || i != successIdx
			providers[i] = &mockProvider{
				name:       name,
				configured: true,
				shouldFail: shouldFail,
			}
		}
		e := newTestEmailNotifier(providers)

		h := &capturingEmailSlogHandler{}
		orig := slog.Default()
		slog.SetDefault(slog.New(h))
		defer slog.SetDefault(orig)

		_ = e.sendEmail(context.Background(), "user@example.com", "User", "subj", "<p>body</p>")

		logs := h.Logs()

		// Every debug entry must have provider, recipient (masked), and attempt fields.
		debugCount := 0
		for _, l := range logs {
			if l.level != slog.LevelDebug {
				continue
			}
			if _, ok := l.attrs["provider"]; !ok {
				t.Fatalf("debug log missing 'provider' field: %+v", l)
			}
			if _, ok := l.attrs["recipient"]; !ok {
				t.Fatalf("debug log missing 'recipient' field: %+v", l)
			}
			if _, ok := l.attrs["attempt"]; !ok {
				t.Fatalf("debug log missing 'attempt' field: %+v", l)
			}
			// Recipient must be masked: ends with @***
			rec := fmt.Sprintf("%v", l.attrs["recipient"])
			if !strings.HasSuffix(rec, "@***") {
				t.Fatalf("recipient not masked in debug log: %q", rec)
			}
			debugCount++
		}
		if debugCount == 0 {
			t.Fatal("no debug log entries found for email provider attempts")
		}

		if successIdx >= 0 {
			// A successful delivery must produce an info-level log with elapsed_total.
			found := false
			for _, l := range logs {
				if l.level == slog.LevelInfo {
					if _, ok := l.attrs["elapsed_total"]; ok {
						found = true
						break
					}
				}
			}
			if !found {
				t.Fatalf("expected info-level log with 'elapsed_total' after successful delivery (successIdx=%d); logs=%+v",
					successIdx, logs)
			}
		}
	})
}
