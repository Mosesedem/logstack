package config

import (
	"os"
	"testing"
)

// requiredEnvVars sets the minimum env vars needed for Load() to pass validation.
// Returns a cleanup function that unsets them.
func setRequiredEnvVars(t *testing.T) {
	t.Helper()
	vars := map[string]string{
		"DATABASE_URL": "postgres://user:pass@localhost:5432/testdb",
		"REDIS_URL":    "redis://localhost:6379",
		"JWT_SECRET":   "test-secret-key",
		"PORT":         "8080",
		"ENV":          "development",
		"BASE_URL":     "http://localhost:8080",
	}
	for k, v := range vars {
		t.Setenv(k, v)
	}
}

// TestNewNotificationFieldsPopulated verifies that each new notification-related
// config field is correctly populated when the corresponding env var is set.
// Validates: Requirements 9.5
func TestNewNotificationFieldsPopulated(t *testing.T) {
	setRequiredEnvVars(t)

	t.Setenv("MAILCOW_API_KEY", "mc-api-key-value")
	t.Setenv("MAILCOW_API_URL", "https://mail.example.com")
	t.Setenv("RESEND_API_KEY", "re_test_key")
	t.Setenv("ZOHO_CLIENT_ID", "zoho-client-id")
	t.Setenv("ZOHO_CLIENT_SECRET", "zoho-client-secret")
	t.Setenv("ZOHO_REFRESH_TOKEN", "zoho-refresh-token")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}

	tests := []struct {
		field string
		got   string
		want  string
	}{
		{"MailcowAPIKey", cfg.MailcowAPIKey, "mc-api-key-value"},
		{"MailcowAPIURL", cfg.MailcowAPIURL, "https://mail.example.com"},
		{"ResendAPIKey", cfg.ResendAPIKey, "re_test_key"},
		{"ZohoClientID", cfg.ZohoClientID, "zoho-client-id"},
		{"ZohoClientSecret", cfg.ZohoClientSecret, "zoho-client-secret"},
		{"ZohoRefreshToken", cfg.ZohoRefreshToken, "zoho-refresh-token"},
	}

	for _, tt := range tests {
		t.Run(tt.field, func(t *testing.T) {
			if tt.got != tt.want {
				t.Errorf("Config.%s = %q, want %q", tt.field, tt.got, tt.want)
			}
		})
	}
}

// TestNewNotificationFieldsMissingVarsAreEmpty verifies that when the notification
// env vars are absent, Load() succeeds and each field defaults to an empty string.
// Validates: Requirements 9.5
func TestNewNotificationFieldsMissingVarsAreEmpty(t *testing.T) {
	setRequiredEnvVars(t)

	// Explicitly ensure none of the new notification vars are set.
	for _, key := range []string{
		"MAILCOW_API_KEY",
		"MAILCOW_API_URL",
		"RESEND_API_KEY",
		"ZOHO_CLIENT_ID",
		"ZOHO_CLIENT_SECRET",
		"ZOHO_REFRESH_TOKEN",
	} {
		os.Unsetenv(key)
	}

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error when optional vars are missing: %v", err)
	}

	fields := []struct {
		name string
		got  string
	}{
		{"MailcowAPIKey", cfg.MailcowAPIKey},
		{"MailcowAPIURL", cfg.MailcowAPIURL},
		{"ResendAPIKey", cfg.ResendAPIKey},
		{"ZohoClientID", cfg.ZohoClientID},
		{"ZohoClientSecret", cfg.ZohoClientSecret},
		{"ZohoRefreshToken", cfg.ZohoRefreshToken},
	}

	for _, f := range fields {
		t.Run(f.name+"_is_empty", func(t *testing.T) {
			if f.got != "" {
				t.Errorf("Config.%s = %q, want empty string", f.name, f.got)
			}
		})
	}
}

// TestLoadReturnsErrorWhenRequiredVarsMissing ensures Load() still fails validation
// when truly required vars (DATABASE_URL, etc.) are absent — a sanity check that
// our use of t.Setenv isolation is working correctly.
func TestLoadReturnsErrorWhenRequiredVarsMissing(t *testing.T) {
	// Do NOT call setRequiredEnvVars — we want validation to fail.
	// Unset vars that could be inherited from a parent .env file at test time.
	for _, key := range []string{"DATABASE_URL", "REDIS_URL", "JWT_SECRET", "PORT", "ENV", "BASE_URL"} {
		t.Setenv(key, "")
	}

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected to return an error when required vars are missing, got nil")
	}
}
