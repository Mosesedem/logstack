package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/api/handlers"
	mobilehandlers "github.com/mosesedem/logstack/internal/api/handlers/mobile"
	"github.com/mosesedem/logstack/internal/api/middleware"
	"github.com/mosesedem/logstack/internal/config"
	"github.com/mosesedem/logstack/internal/db"
	"github.com/mosesedem/logstack/internal/services"
	"github.com/mosesedem/logstack/internal/services/notification"
	"github.com/mosesedem/logstack/internal/websocket"
	"github.com/mosesedem/logstack/internal/workers"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type RouterConfig struct {
	DB                  *gorm.DB
	Redis               *redis.Client
	Ingestor            *services.Ingestor
	QueryBuilder        *services.QueryBuilder
	AuthService         *services.AuthService
	AlertEngine         *services.AlertEngine
	BillingService      *services.BillingService
	OrganizationService *services.OrganizationService
	AuditService        *services.AuditService
	UsageSyncWorker     *workers.UsageSyncWorker
	Hub                 *websocket.Hub
	Config              *config.Config
	NotificationService *notification.Service
}

func NewRouter(cfg *RouterConfig) *gin.Engine {
	if cfg.Config.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	
	// Global middleware
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.Config.AllowedOrigins))
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger())

	// Health check routes — registered BEFORE the global rate limiter
	// so Docker/nginx health probes are never rate-limited.
	r.GET("/health", handlers.Health(cfg.DB, cfg.Redis))
	r.GET("/ready", handlers.Ready(cfg.DB, cfg.Redis))
	r.GET("/test", handlers.Test())

	// Global rate limiter (applied after health routes)
	globalLimiter := middleware.NewRateLimiter(cfg.Redis, cfg.Config.RateLimitRequests, cfg.Config.RateLimitWindow)
	r.Use(globalLimiter.Limit())

	// API v1
	v1 := r.Group("/v1")
	{
		// Auth routes — public, with a generous rate limit for programmatic clients
		// (NextAuth calls /refresh and /oauth automatically; 10/min was too tight).
		auth := v1.Group("/auth")
		authLimiter := middleware.NewRateLimiter(cfg.Redis, 60, time.Minute)
		auth.Use(authLimiter.Limit())
		var authEmailNotifier *notification.EmailNotifier
		if cfg.NotificationService != nil {
			authEmailNotifier = cfg.NotificationService.GetEmailNotifier()
		}
		authHandler := handlers.NewAuthHandler(cfg.DB, cfg.AuthService, authEmailNotifier, cfg.Redis)
		{
			auth.POST("/signup", authHandler.Signup)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/mobile-refresh", authHandler.RefreshMobileToken)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
			auth.GET("/verify-email", authHandler.VerifyEmail)
			auth.POST("/resend-verification", authHandler.ResendVerification)
			auth.POST("/oauth", authHandler.OAuthSignIn)
			auth.POST("/logout", middleware.JWTAuth(cfg.AuthService), authHandler.Logout)
			auth.POST("/qr/:token/confirm", authHandler.ConfirmQR)
			auth.POST("/qr/pin-confirm", authHandler.ConfirmQRByPIN)
			auth.GET("/accept-invite", authHandler.AcceptInvite)
		}

		// Log ingestion (API key auth with higher rate limit)
		logs := v1.Group("/logs")
		ingestLimiter := middleware.NewRateLimiter(cfg.Redis, 1000, time.Minute)
		var ingestEmailNotifier *notification.EmailNotifier
		if cfg.NotificationService != nil {
			ingestEmailNotifier = cfg.NotificationService.GetEmailNotifier()
		}
		usageLimiter := middleware.NewUsageLimitMiddleware(cfg.DB, cfg.Redis, ingestEmailNotifier)
		logs.Use(middleware.APIKeyAuth(cfg.DB))
		logs.Use(ingestLimiter.LimitByAPIKey())
		logs.Use(usageLimiter.Enforce()) // Enforce usage limits based on tier
		{
			logsHandler := handlers.NewLogsHandler(cfg.Ingestor, cfg.QueryBuilder)
			logs.POST("", logsHandler.IngestBatch)
			logs.GET("", logsHandler.Query)
			logs.GET("/:id", logsHandler.GetByID)
		}

		// Real-time log stream (WebSocket). Uses WSAuth so browsers can pass the
		// JWT via the Sec-WebSocket-Protocol header or ?token= query param. The
		// mobile-namespaced /mobile/stream route below is kept for native clients.
		v1.GET("/stream",
			middleware.WSAuth(cfg.AuthService),
			mobilehandlers.NewMobileHandler(cfg.DB, cfg.Hub).Stream,
		)

		// Public pricing (landing page + marketing)
		billingHandler := handlers.NewBillingHandler(cfg.BillingService, cfg.UsageSyncWorker, cfg.DB)
		v1.GET("/billing/pricing", billingHandler.GetPricing)

		// Dashboard routes (JWT auth)
		protected := v1.Group("")
		protected.Use(middleware.JWTAuth(cfg.AuthService))
		{
			// QR code login generation (JWT-protected — web user generates QR)
			protected.POST("/auth/qr/generate", authHandler.GenerateQR)
			protected.GET("/auth/qr/:token/status", authHandler.GetQRStatus)
			protected.POST("/auth/mobile-logout", authHandler.MobileLogout)

			// Projects
			projects := protected.Group("/projects")
			{
				projectsHandler := handlers.NewProjectsHandler(cfg.DB)
				projects.GET("", projectsHandler.List)
				projects.POST("", projectsHandler.Create)
				
				// Project-specific routes with ownership check
				projectRoutes := projects.Group("/:id")
				projectRoutes.Use(middleware.RequireProjectOwner(cfg.DB))
				{
					projectRoutes.GET("", projectsHandler.Get)
					projectRoutes.PUT("", projectsHandler.Update)
					projectRoutes.DELETE("", projectsHandler.Delete)
					projectRoutes.POST("/rotate-key", projectsHandler.RotateAPIKey)
					
					// Project logs (for dashboard viewing)
					projectLogsHandler := handlers.NewProjectLogsHandler(cfg.QueryBuilder)
					projectRoutes.GET("/logs", projectLogsHandler.Query)
					projectRoutes.GET("/logs/analytics", projectLogsHandler.Analytics)
					projectRoutes.PATCH("/archive", projectsHandler.Archive)
				}
			}

			// Alerts
			alerts := protected.Group("/alerts")
			{
				alertsHandler := handlers.NewAlertsHandler(cfg.AlertEngine, cfg.DB)
				alerts.GET("", alertsHandler.List)
				alerts.POST("", alertsHandler.Create)
				alerts.GET("/options", alertsHandler.GetOptions)
				alerts.GET("/:id", alertsHandler.Get)
				alerts.PUT("/:id", alertsHandler.Update)
				alerts.DELETE("/:id", alertsHandler.Delete)
				alerts.GET("/:id/history", alertsHandler.GetHistory)
			}

			// User settings
			users := protected.Group("/users")
			{
				usersHandler := handlers.NewUsersHandler(cfg.DB, cfg.AuthService)
				users.GET("/me", usersHandler.GetCurrentUser)
				users.PUT("/me", usersHandler.UpdateCurrentUser)
				users.PUT("/me/password", usersHandler.UpdatePassword)
				users.POST("/me/logout-all", usersHandler.LogoutAll)
			}

			// Billing
			billing := protected.Group("/billing")
			{
				billing.GET("/subscription", billingHandler.GetSubscription)
				billing.GET("/usage", billingHandler.GetUsage)
				billing.POST("/initialize", billingHandler.InitializePayment)
				billing.GET("/transactions", billingHandler.GetTransactions)
				billing.POST("/cancel", billingHandler.CancelSubscription)
				billing.GET("/invoices", billingHandler.GetInvoices)
				billing.GET("/invoices/:id", billingHandler.GetInvoice)
			}

			// Organizations
			organizations := protected.Group("/organizations")
			{
				orgHandler := handlers.NewOrganizationHandler(cfg.OrganizationService, cfg.DB, cfg.NotificationService.GetEmailNotifier())
				organizations.GET("/me", orgHandler.GetMyOrganization)
				organizations.GET("/:id/members", orgHandler.GetMembers)
				organizations.POST("/:id/members", orgHandler.InviteMember)
				organizations.PATCH("/:id/members/:memberId", middleware.RBACMiddleware(cfg.DB, "admin"), middleware.PriceGateMiddleware(cfg.DB, "team_management"), orgHandler.UpdateMemberRole)
				organizations.DELETE("/:id/members/:memberId", orgHandler.RemoveMember)
				organizations.PATCH("/:id", orgHandler.UpdateOrganization)
				organizations.POST("/:id/invites", middleware.RBACMiddleware(cfg.DB, "admin"), middleware.PriceGateMiddleware(cfg.DB, "team_management"), orgHandler.CreateInvite)
				organizations.GET("/:id/invites", middleware.RBACMiddleware(cfg.DB, "admin"), middleware.PriceGateMiddleware(cfg.DB, "team_management"), orgHandler.GetInvites)
				organizations.DELETE("/:id/invites/:inviteId", middleware.RBACMiddleware(cfg.DB, "admin"), middleware.PriceGateMiddleware(cfg.DB, "team_management"), orgHandler.RevokeInvite)
			}

			// Audit Logs
			audit := protected.Group("/audit")
			{
				auditHandler := handlers.NewAuditHandler(cfg.AuditService, cfg.OrganizationService)
				audit.GET("", auditHandler.GetAuditLogs)
				audit.GET("/actions", auditHandler.GetAuditActions)
				audit.GET("/:resource_type/:resource_id", auditHandler.GetResourceAuditLogs)
			}

			// Admin routes
			admin := protected.Group("/admin")
			admin.Use(middleware.AdminOnly(cfg.DB))
			{
				adminHandler := handlers.NewAdminHandler(cfg.DB)
				admin.GET("/stats", adminHandler.GetSystemStats)
				admin.GET("/users", adminHandler.GetUsers)
				admin.GET("/projects", adminHandler.GetProjects)
			}
		}


		// Webhooks (no auth - use signature verification)
		webhooks := v1.Group("/webhooks")
		{
			// Paystack webhook handler (created without BillingHandler dependency to avoid nil pointer)
			if cfg.BillingService != nil {
				billingHandler := handlers.NewBillingHandler(cfg.BillingService, cfg.UsageSyncWorker, cfg.DB)
				webhooks.POST("/paystack", billingHandler.HandleWebhook)
			}
		}

		// Mobile routes
		mobile := v1.Group("/mobile")
		{
			// Push token registration (JWT auth)
			mobile.Use(middleware.JWTAuth(cfg.AuthService))
			mobileHandler := mobilehandlers.NewMobileHandler(cfg.DB, cfg.Hub)
			mobile.POST("/push-token", mobileHandler.RegisterPushToken)
			mobile.DELETE("/push-token", mobileHandler.DeletePushToken)
			
			// WebSocket stream
			mobile.GET("/stream", mobileHandler.Stream)
		}
	}

	return r
}

// Health returns basic health status
func Health(database *gorm.DB, redis *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// Ready checks all dependencies
func Ready(database *gorm.DB, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		errors := make([]string, 0)

		// Check database
		if err := db.HealthCheck(database); err != nil {
			errors = append(errors, "database: "+err.Error())
		}

		// Check Redis
		if err := redisClient.Ping(c.Request.Context()).Err(); err != nil {
			errors = append(errors, "redis: "+err.Error())
		}

		if len(errors) > 0 {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "unhealthy",
				"errors": errors,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "ready",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	}
}
