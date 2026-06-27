package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/mosesedem/logstack/internal/api"
	"github.com/mosesedem/logstack/internal/config"
	redisdb "github.com/mosesedem/logstack/internal/db"
	"github.com/mosesedem/logstack/internal/services"
	"github.com/mosesedem/logstack/internal/services/notification"
	"github.com/mosesedem/logstack/internal/websocket"
	"github.com/mosesedem/logstack/internal/workers"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	ctx := context.Background()

	// Load config
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}

	if len(cfg.AllowedOrigins) == 0 {
		slog.Warn("ALLOWED_ORIGINS is empty; browser clients will be blocked by CORS")
	} else {
		slog.Info("CORS allowed origins configured", "origins", cfg.AllowedOrigins)
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		slog.Error("Failed to connect to database", "error", err)
		os.Exit(1)
	}

	// Run migrations (creates PG enums, then AutoMigrate)
	if err := redisdb.RunMigrations(db); err != nil {
		slog.Error("Failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Connect to Redis
	rdb, err := redisdb.NewRedis(cfg.RedisURL, cfg.RedisPoolSize)
	if err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}

	// Test Redis connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}

	// Initialize notification service
	notifier := notification.NewNotificationServiceWithDB(cfg, db)

	// Initialize services with gorm.DB
	ingestor := services.NewIngestor(db, rdb)
	queryBuilder := services.NewQueryBuilder(db)
	authService := services.NewAuthService(services.AuthServiceConfig{
		JWTSecret:          cfg.JWTSecret,
		Redis:              rdb,
		AccessTokenExpiry:  cfg.AccessTokenExpiry,
		RefreshTokenExpiry: cfg.RefreshTokenExpiry,
	})
	alertEngine := services.NewAlertEngine(db, rdb, notifier)
	polarService := services.NewPolarService(db, services.PolarConfig{
		AccessToken:    cfg.PolarAccessToken,
		WebhookSecret:  cfg.PolarWebhookSecret,
		ProductStarter: cfg.PolarProductStarter,
		ProductPro:     cfg.PolarProductPro,
	})
	billingService := services.NewBillingService(db, cfg.PaystackSecretKey, cfg.PaystackPublicKey, cfg.PaystackWebhookURL, polarService)
	auditService := services.NewAuditService(db)
	organizationService := services.NewOrganizationService(db, auditService)

	// Initialize WebSocket hub
	hub := websocket.NewHub()
	go hub.Run(context.Background())

	// Start Redis subscriber for broadcasting
	broadcaster := websocket.NewBroadcaster(rdb, hub)
	go broadcaster.Start(context.Background())

	// Start alert processor worker
	alertProcessor := workers.NewAlertProcessor(db, alertEngine)
	go alertProcessor.Start(context.Background())

	// Start log retention worker
	logRetentionWorker := workers.NewLogRetentionWorker(db)
	go logRetentionWorker.Start(context.Background())

	// Start usage sync worker
	usageSyncWorker := workers.NewUsageSyncWorker(db, rdb, notifier.GetEmailNotifier(), cfg.UsageSyncInterval)
	go usageSyncWorker.Start(context.Background())

	// Setup router
	router := api.NewRouter(&api.RouterConfig{
		DB:                  db,
		Redis:               rdb,
		Ingestor:            ingestor,
		QueryBuilder:        queryBuilder,
		AuthService:         authService,
		AlertEngine:         alertEngine,
		BillingService:      billingService,
		OrganizationService: organizationService,
		AuditService:        auditService,
		UsageSyncWorker:     usageSyncWorker,
		Hub:                 hub,
		Config:              cfg,
		NotificationService: notifier,
	})

	// Start server
	slog.Info("Starting server", "port", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		slog.Error("Server error", "error", err)
		os.Exit(1)
	}
}


