package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// Database
	DatabaseURL    string
	DBMaxIdleConns int
	DBMaxOpenConns int
	DBConnMaxLife  time.Duration

	// Redis
	RedisURL      string
	RedisPoolSize int

	// Auth
	JWTSecret          string
	AccessTokenExpiry  time.Duration
	RefreshTokenExpiry time.Duration

	// External services
	BrevoAPIKey           string
	FCMServiceAccountPath string
	FCMProjectID          string
	BaseURL               string
	MailcowAPIKey         string
	MailcowAPIURL         string
	ResendAPIKey          string
	ZohoClientID          string
	ZohoClientSecret      string
	ZohoRefreshToken      string

	// Server
	Port           string
	Env            string
	AllowedOrigins []string
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
	IdleTimeout    time.Duration

	// Rate limiting
	RateLimitRequests int
	RateLimitWindow   time.Duration

	// Logging
	LogLevel string
	LogJSON  bool

	// Paystack (Billing)
	PaystackSecretKey  string
	PaystackPublicKey  string
	PaystackWebhookURL string

	// Usage tracking
	UsageSyncInterval time.Duration
}

func Load() (*Config, error) {
	if err := loadDotEnv(); err != nil {
		return nil, err
	}

	cfg := &Config{
		// Database
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		DBMaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 0),
		DBMaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 0),
		DBConnMaxLife:  getEnvDuration("DB_CONN_MAX_LIFE", 0),

		// Redis
		RedisURL:      getEnv("REDIS_URL", ""),
		RedisPoolSize: getEnvInt("REDIS_POOL_SIZE", 0),

		// Auth
		JWTSecret:          getEnv("JWT_SECRET", ""),
		AccessTokenExpiry:  getEnvDuration("ACCESS_TOKEN_EXPIRY", 0),
		RefreshTokenExpiry: getEnvDuration("REFRESH_TOKEN_EXPIRY", 0),

		// External services
		BrevoAPIKey:           getEnv("BREVO_API_KEY", ""),
		FCMServiceAccountPath: getEnv("FCM_SERVICE_ACCOUNT_PATH", ""),
		FCMProjectID:          getEnv("FCM_PROJECT_ID", ""),
		BaseURL:               getEnv("BASE_URL", ""),
		MailcowAPIKey:         getEnv("MAILCOW_API_KEY", ""),
		MailcowAPIURL:         getEnv("MAILCOW_API_URL", ""),
		ResendAPIKey:          getEnv("RESEND_API_KEY", ""),
		ZohoClientID:          getEnv("ZOHO_CLIENT_ID", ""),
		ZohoClientSecret:      getEnv("ZOHO_CLIENT_SECRET", ""),
		ZohoRefreshToken:      getEnv("ZOHO_REFRESH_TOKEN", ""),

		// Server
		Port:         getEnv("PORT", ""),
		Env:          getEnv("ENV", ""),
		ReadTimeout:  getEnvDuration("READ_TIMEOUT", 0),
		WriteTimeout: getEnvDuration("WRITE_TIMEOUT", 0),
		IdleTimeout:  getEnvDuration("IDLE_TIMEOUT", 0),

		// Rate limiting
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 0),
		RateLimitWindow:   getEnvDuration("RATE_LIMIT_WINDOW", 0),

		// Logging
		LogLevel: getEnv("LOG_LEVEL", ""),
		LogJSON:  getEnvBool("LOG_JSON", false),

		// Paystack (Billing)
		PaystackSecretKey:  getEnv("PAYSTACK_SECRET_KEY", ""),
		PaystackPublicKey:  getEnv("PAYSTACK_PUBLIC_KEY", ""),
		PaystackWebhookURL: getEnv("PAYSTACK_WEBHOOK_URL", ""),

		// Usage tracking
		UsageSyncInterval: getEnvDuration("USAGE_SYNC_INTERVAL", 0),
	}

	// Parse allowed origins; pair apex <-> www so dashboards on either host work.
	cfg.AllowedOrigins = expandAllowedOrigins(splitAndTrim(getEnv("ALLOWED_ORIGINS", ""), ","))

	// Validate required fields in production
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL must be set")
	}
	if c.RedisURL == "" {
		return errors.New("REDIS_URL must be set")
	}
	if c.JWTSecret == "" {
		return errors.New("JWT_SECRET must be set")
	}
	if c.Port == "" {
		return errors.New("PORT must be set")
	}
	if c.Env == "" {
		return errors.New("ENV must be set")
	}
	if c.BaseURL == "" {
		return errors.New("BASE_URL must be set")
	}

	if c.IsProduction() {
		if len(c.JWTSecret) < 32 {
			return errors.New("JWT_SECRET must be at least 32 characters")
		}
	}
	return nil
}

func loadDotEnv() error {
	file, err := os.Open(".env")
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("open .env: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}

		equalsIndex := strings.Index(line, "=")
		if equalsIndex < 1 {
			continue
		}

		key := strings.TrimSpace(line[:equalsIndex])
		value := strings.TrimSpace(line[equalsIndex+1:])
		if key == "" {
			continue
		}

		if !strings.HasPrefix(value, "\"") && !strings.HasPrefix(value, "'") {
			if commentIndex := strings.Index(value, " #"); commentIndex >= 0 {
				value = strings.TrimSpace(value[:commentIndex])
			} else if commentIndex := strings.Index(value, "\t#"); commentIndex >= 0 {
				value = strings.TrimSpace(value[:commentIndex])
			}
		}

		value = strings.Trim(value, `"'`)
		if _, exists := os.LookupEnv(key); !exists {
			if err := os.Setenv(key, value); err != nil {
				return fmt.Errorf("set %s from .env: %w", key, err)
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read .env: %w", err)
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}

func splitAndTrim(s, sep string) []string {
	parts := make([]string, 0)
	for _, p := range strings.Split(s, sep) {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return parts
}

// expandAllowedOrigins adds the www/apex counterpart for each configured HTTPS origin
// (e.g. https://logstack.tech also allows https://www.logstack.tech). Wildcard "*"
// and non-apex hosts (api.example.com, localhost) are left unchanged.
func expandAllowedOrigins(origins []string) []string {
	if len(origins) == 0 {
		return origins
	}

	seen := make(map[string]struct{}, len(origins)*2)
	expanded := make([]string, 0, len(origins)*2)

	add := func(origin string) {
		if origin == "" {
			return
		}
		if _, ok := seen[origin]; ok {
			return
		}
		seen[origin] = struct{}{}
		expanded = append(expanded, origin)
	}

	for _, origin := range origins {
		add(origin)
		if origin == "*" {
			continue
		}
		if pair, ok := pairedWWWOrigin(origin); ok {
			add(pair)
		}
	}

	return expanded
}

func pairedWWWOrigin(origin string) (string, bool) {
	const (
		httpPrefix  = "http://"
		httpsPrefix = "https://"
	)

	var scheme, host string
	switch {
	case strings.HasPrefix(origin, httpsPrefix):
		scheme, host = "https", strings.TrimPrefix(origin, httpsPrefix)
	case strings.HasPrefix(origin, httpPrefix):
		scheme, host = "http", strings.TrimPrefix(origin, httpPrefix)
	default:
		return "", false
	}

	if host == "" || strings.Contains(host, "/") {
		return "", false
	}

	host, _, _ = strings.Cut(host, ":")
	if host == "localhost" || host == "127.0.0.1" {
		return "", false
	}

	if strings.HasPrefix(host, "www.") {
		return scheme + "://" + strings.TrimPrefix(host, "www."), true
	}

	// Only pair apex domains (example.com), not other subdomains (api.example.com).
	if strings.Count(host, ".") != 1 {
		return "", false
	}

	return scheme + "://www." + host, true
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func (c *Config) IsProduction() bool {
	return c.Env == "production"
}
