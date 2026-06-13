package config

import (
	"errors"
	"os"
	"strconv"
	"time"
)

type Config struct {
	// Database
	DatabaseURL     string
	DBMaxIdleConns  int
	DBMaxOpenConns  int
	DBConnMaxLife   time.Duration

	// Redis
	RedisURL        string
	RedisPoolSize   int

	// Auth
	JWTSecret           string
	AccessTokenExpiry   time.Duration
	RefreshTokenExpiry  time.Duration

	// External services
	BrevoAPIKey string
	FCMServiceAccountPath string
	FCMProjectID string
	BaseURL string

	// Server
	Port            string
	Env             string
	AllowedOrigins  []string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration

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
	cfg := &Config{
		// Database
		DatabaseURL:    getEnv("DATABASE_URL", "postgresql://neondb_owner:npg_7uoBpXj0EPzU@ep-sparkling-shape-ah5kbew2-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"),
		DBMaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 10),
		DBMaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 100),
		DBConnMaxLife:  getEnvDuration("DB_CONN_MAX_LIFE", 30*time.Minute),

		// Redis
		RedisURL:      getEnv("REDIS_URL", "redis://default:ioq85yA8WYDn4wOAsIPMiZYuAWu5w5MM@redis-14549.c261.us-east-1-4.ec2.redns.redis-cloud.com:14549"),
		RedisPoolSize: getEnvInt("REDIS_POOL_SIZE", 10),

		// Auth
		JWTSecret:          getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
		AccessTokenExpiry:  getEnvDuration("ACCESS_TOKEN_EXPIRY", 15*time.Minute),
		RefreshTokenExpiry: getEnvDuration("REFRESH_TOKEN_EXPIRY", 7*24*time.Hour),

		// External services
		BrevoAPIKey: getEnv("BREVO_API_KEY", ""),
		FCMServiceAccountPath: getEnv("FCM_SERVICE_ACCOUNT_PATH", ""),
		FCMProjectID: getEnv("FCM_PROJECT_ID", ""),
		BaseURL: getEnv("BASE_URL", "http://localhost:3000"),

		// Server
		Port:         getEnv("PORT", "8080"),
		Env:          getEnv("ENV", "development"),
		ReadTimeout:  getEnvDuration("READ_TIMEOUT", 15*time.Second),
		WriteTimeout: getEnvDuration("WRITE_TIMEOUT", 15*time.Second),
		IdleTimeout:  getEnvDuration("IDLE_TIMEOUT", 60*time.Second),

		// Rate limiting
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitWindow:   getEnvDuration("RATE_LIMIT_WINDOW", time.Minute),

		// Logging
		LogLevel: getEnv("LOG_LEVEL", "info"),
		LogJSON:  getEnvBool("LOG_JSON", false),

		// Paystack (Billing)
		PaystackSecretKey:  getEnv("PAYSTACK_SECRET_KEY", ""),
		PaystackPublicKey:  getEnv("PAYSTACK_PUBLIC_KEY", ""),
		PaystackWebhookURL: getEnv("PAYSTACK_WEBHOOK_URL", ""),

		// Usage tracking
		UsageSyncInterval: getEnvDuration("USAGE_SYNC_INTERVAL", 1*time.Minute),
	}

	// Parse allowed origins
	origins := getEnv("ALLOWED_ORIGINS", "*")
	if origins == "*" {
		cfg.AllowedOrigins = []string{"*"}
	} else {
		cfg.AllowedOrigins = splitAndTrim(origins, ",")
	}

	// Validate required fields in production
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.IsProduction() {
		if c.JWTSecret == "" || c.JWTSecret == "development-secret-change-in-production" {
			return errors.New("JWT_SECRET must be set in production")
		}
		if len(c.JWTSecret) < 32 {
			return errors.New("JWT_SECRET must be at least 32 characters")
		}
	}

	// Use default in development
	if c.JWTSecret == "" {
		c.JWTSecret = "development-secret-change-in-production"
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
	for _, p := range splitString(s, sep) {
		if trimmed := trimSpace(p); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return parts
}

func splitString(s, sep string) []string {
	if s == "" {
		return nil
	}
	result := make([]string, 0)
	start := 0
	for i := 0; i < len(s); i++ {
		if i+len(sep) <= len(s) && s[i:i+len(sep)] == sep {
			result = append(result, s[start:i])
			start = i + len(sep)
			i += len(sep) - 1
		}
	}
	result = append(result, s[start:])
	return result
}

func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

