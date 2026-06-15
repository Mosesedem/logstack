package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"github.com/mosesedem/logstack/internal/services/notification"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db            *gorm.DB
	authService   *services.AuthService
	emailNotifier *notification.EmailNotifier
	redis         *redis.Client
}

func NewAuthHandler(db *gorm.DB, authService *services.AuthService, emailNotifier *notification.EmailNotifier, redisClient *redis.Client) *AuthHandler {
	return &AuthHandler{
		db:            db,
		authService:   authService,
		emailNotifier: emailNotifier,
		redis:         redisClient,
	}
}

type SignupRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	Name     string `json:"name" binding:"required,min=1,max=100"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type AuthResponse struct {
	User   models.UserResponse   `json:"user"`
	Tokens *services.TokenPair   `json:"tokens"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Signup handles POST /v1/auth/signup
func (h *AuthHandler) Signup(c *gin.Context) {
	var req SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Normalize email
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	// Check if user exists
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, ErrorResponse{
			Code:    "EMAIL_EXISTS",
			Message: "An account with this email already exists",
		})
		return
	}

	// Create user
	user := models.User{
		Email:         req.Email,
		Name:          req.Name,
		EmailVerified: false,
	}
	if err := user.SetPassword(req.Password); err != nil {
		slog.Error("Failed to hash password", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to create account",
		})
		return
	}

	// Generate verification token
	if err := user.GenerateVerificationToken(); err != nil {
		slog.Error("Failed to generate verification token", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to create account",
		})
		return
	}

	if err := h.db.Create(&user).Error; err != nil {
		slog.Error("Failed to create user", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to create account",
		})
		return
	}

	// Send verification email (non-blocking)
	if h.emailNotifier != nil && user.VerificationToken != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := h.emailNotifier.SendVerificationEmail(ctx, user.Email, user.Name, *user.VerificationToken); err != nil {
				slog.Error("Failed to send verification email", "error", err, "email", user.Email)
			} else {
				slog.Info("Verification email sent", "email", user.Email)
			}
		}()
	}

	// Generate tokens
	tokens, err := h.authService.GenerateTokens(&user)
	if err != nil {
		slog.Error("Failed to generate tokens", "error", err, "userID", user.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to generate authentication tokens",
		})
		return
	}

	slog.Info("User signed up", "userID", user.ID, "email", user.Email)

	c.JSON(http.StatusCreated, AuthResponse{
		User:   user.ToResponse(),
		Tokens: tokens,
	})
}

// Login handles POST /v1/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	// Normalize email
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Use same error message to prevent email enumeration
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    "INVALID_CREDENTIALS",
			Message: "Invalid email or password",
		})
		return
	}

	if !user.CheckPassword(req.Password) {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    "INVALID_CREDENTIALS",
			Message: "Invalid email or password",
		})
		return
	}

	tokens, err := h.authService.GenerateTokens(&user)
	if err != nil {
		slog.Error("Failed to generate tokens", "error", err, "userID", user.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to generate authentication tokens",
		})
		return
	}

	slog.Info("User logged in", "userID", user.ID)

	c.JSON(http.StatusOK, AuthResponse{
		User:   user.ToResponse(),
		Tokens: tokens,
	})
}

// RefreshToken handles POST /v1/auth/refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	tokens, err := h.authService.RefreshTokens(req.RefreshToken, h.db)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Code:    "INVALID_REFRESH_TOKEN",
			Message: "Invalid or expired refresh token",
		})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// Logout handles POST /v1/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	token, exists := c.Get("token")
	if !exists {
		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
		return
	}

	// Blacklist the current token
	if err := h.authService.BlacklistToken(c.Request.Context(), token.(string), h.authService.GetAccessTokenExpiry()); err != nil {
		slog.Warn("Failed to blacklist token", "error", err)
	}

	userID, _ := c.Get("userID")
	slog.Info("User logged out", "userID", userID)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Token    string `json:"token" binding:"required"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

// ForgotPassword handles POST /v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Log error but return success to avoid enumeration
		slog.Info("Forgot password request for non-existent email", "email", req.Email)
		c.JSON(http.StatusOK, gin.H{"message": "If an account with that email exists, we sent you a reset link"})
		return
	}

	token, err := h.authService.GenerateResetToken(c.Request.Context(), user.Email)
	if err != nil {
		slog.Error("Failed to generate reset token", "error", err)
		c.JSON(http.StatusOK, gin.H{"message": "If an account with that email exists, we sent you a reset link"})
		return
	}

	// Send password reset email
	if h.emailNotifier != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := h.emailNotifier.SendPasswordResetEmail(ctx, user.Email, user.Name, token); err != nil {
				slog.Error("Failed to send password reset email", "error", err, "email", user.Email)
			} else {
				slog.Info("Password reset email sent", "email", user.Email)
			}
		}()
	}

	c.JSON(http.StatusOK, gin.H{"message": "If an account with that email exists, we sent you a reset link"})
}

// ResetPassword handles POST /v1/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}

	email, err := h.authService.ValidateResetToken(c.Request.Context(), req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "INVALID_TOKEN", Message: "Invalid or expired reset token"})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", email).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "User not found"})
		return
	}

	if err := user.SetPassword(req.Password); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update password"})
		return
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update password"})
		return
	}

	// Invalidate token
	if err := h.authService.InvalidateResetToken(c.Request.Context(), req.Token); err != nil {
		slog.Warn("Failed to invalidate reset token", "error", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

type ResendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// VerifyEmail handles GET /v1/auth/verify-email?token=xxx
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_TOKEN",
			Message: "Verification token is required",
		})
		return
	}

	var user models.User
	if err := h.db.Where("verification_token = ?", token).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "INVALID_TOKEN",
			Message: "Invalid or expired verification token",
		})
		return
	}

	if !user.IsVerificationTokenValid() {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "TOKEN_EXPIRED",
			Message: "Verification token has expired. Please request a new one.",
		})
		return
	}

	user.ClearVerificationToken()
	if err := h.db.Save(&user).Error; err != nil {
		slog.Error("Failed to verify user email", "error", err, "userID", user.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to verify email",
		})
		return
	}

	slog.Info("User email verified", "userID", user.ID, "email", user.Email)
	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
}

// OAuthSignIn handles POST /v1/auth/oauth
// Called by NextAuth after a successful Google/GitHub sign-in to sync the user with the backend.
func (h *AuthHandler) OAuthSignIn(c *gin.Context) {
	var req struct {
		Provider   string `json:"provider" binding:"required"`
		ProviderID string `json:"providerId" binding:"required"`
		Email      string `json:"email" binding:"required,email"`
		Name       string `json:"name"`
		Image      string `json:"image"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Find or create user by email
	var user models.User
	err := h.db.Where("email = ?", req.Email).First(&user).Error
	if err != nil {
		// User doesn't exist — create them
		user = models.User{
			Email:         req.Email,
			Name:          req.Name,
			EmailVerified: true, // OAuth providers verify email
			PasswordHash:  "",   // No password for OAuth users
		}
		// Set a random unusable password so the not-null constraint is satisfied
		randomBytes := make([]byte, 32)
		if _, randErr := rand.Read(randomBytes); randErr == nil {
			user.PasswordHash = hex.EncodeToString(randomBytes)
		}

		if createErr := h.db.Create(&user).Error; createErr != nil {
			slog.Error("Failed to create OAuth user", "error", createErr, "email", req.Email)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create account"})
			return
		}
		slog.Info("OAuth user created", "userID", user.ID, "provider", req.Provider)
	} else if !user.EmailVerified {
		// Existing user signing in via OAuth — mark email as verified
		h.db.Model(&user).Update("email_verified", true)
		user.EmailVerified = true
	}

	tokens, err := h.authService.GenerateTokens(&user)
	if err != nil {
		slog.Error("Failed to generate tokens for OAuth user", "error", err, "userID", user.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to generate tokens"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		User:   user.ToResponse(),
		Tokens: tokens,
	})
}
func (h *AuthHandler) ResendVerification(c *gin.Context) {
	var req ResendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Check rate limit (3 per hour)
	if !h.checkVerificationRateLimit(c.Request.Context(), req.Email) {
		c.JSON(http.StatusTooManyRequests, ErrorResponse{
			Code:    "RATE_LIMIT_EXCEEDED",
			Message: "Maximum 3 verification emails per hour. Please try again later.",
		})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Return success to prevent email enumeration
		c.JSON(http.StatusOK, gin.H{"message": "If an account with that email exists and is not verified, we sent a new verification link"})
		return
	}

	if user.EmailVerified {
		c.JSON(http.StatusOK, gin.H{"message": "Email is already verified"})
		return
	}

	// Generate new verification token
	if err := user.GenerateVerificationToken(); err != nil {
		slog.Error("Failed to generate verification token", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to generate verification token",
		})
		return
	}

	if err := h.db.Save(&user).Error; err != nil {
		slog.Error("Failed to save verification token", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to save verification token",
		})
		return
	}

	// Record rate limit
	h.recordVerificationSent(c.Request.Context(), req.Email)

	// Send verification email
	if h.emailNotifier != nil && user.VerificationToken != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := h.emailNotifier.SendVerificationEmail(ctx, user.Email, user.Name, *user.VerificationToken); err != nil {
				slog.Error("Failed to send verification email", "error", err, "email", user.Email)
			} else {
				slog.Info("Verification email resent", "email", user.Email)
			}
		}()
	}

	c.JSON(http.StatusOK, gin.H{"message": "If an account with that email exists and is not verified, we sent a new verification link"})
}

// checkVerificationRateLimit checks if the email has exceeded the rate limit (3 per hour)
func (h *AuthHandler) checkVerificationRateLimit(ctx context.Context, email string) bool {
	// Try Redis first
	if h.redis != nil {
		key := "verify_ratelimit:" + email
		count, err := h.redis.Get(ctx, key).Int()
		if err == nil && count >= 3 {
			return false
		}
	}

	// Fallback to PostgreSQL
	var count int64
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	h.db.Model(&struct{}{}).Table("verification_rate_limits").
		Where("email = ? AND sent_at > ?", email, oneHourAgo).
		Count(&count)

	return count < 3
}

// recordVerificationSent records that a verification email was sent
func (h *AuthHandler) recordVerificationSent(ctx context.Context, email string) {
	// Try Redis first
	if h.redis != nil {
		key := "verify_ratelimit:" + email
		pipe := h.redis.Pipeline()
		pipe.Incr(ctx, key)
		pipe.Expire(ctx, key, 1*time.Hour)
		pipe.Exec(ctx)
	}

	// Also record in PostgreSQL for fallback
	h.db.Exec("INSERT INTO verification_rate_limits (email, sent_at) VALUES (?, ?)", email, time.Now())
}
