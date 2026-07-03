package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"github.com/mosesedem/logstack/internal/services/notification"
	qrcode "github.com/skip2/go-qrcode"
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

// QRSession represents the Redis-persisted state for a QR login session.
type QRSession struct {
	Status          string `json:"status"`                    // "pending" | "confirmed"
	PIN             string `json:"pin,omitempty"`             // 6-digit PIN, omitted from status responses
	InitiatorUserID uint   `json:"initiatorUserId,omitempty"` // web user who generated the session
	UserID          uint   `json:"userId,omitempty"`          // populated after confirmation
	CreatedAt       int64  `json:"createdAt"`
}

// GetQRStatus handles GET /v1/auth/qr/:token/status (JWT-protected).
// Reads the QR session from Redis. Returns 410 if expired/missing, otherwise returns only status.
func (h *AuthHandler) GetQRStatus(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_TOKEN",
			Message: "Token parameter is required",
		})
		return
	}

	ctx := c.Request.Context()
	key := "qr:session:" + token

	val, err := h.redis.Get(ctx, key).Result()
	if err != nil {
		// redis.Nil means key not found (expired or never existed)
		c.JSON(http.StatusGone, ErrorResponse{
			Code:    "QR_EXPIRED",
			Message: "QR code has expired or does not exist",
		})
		return
	}

	var session QRSession
	if jsonErr := json.Unmarshal([]byte(val), &session); jsonErr != nil {
		slog.Error("Failed to parse QR session", "error", jsonErr, "token", token)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to read session",
		})
		return
	}

	// Never expose pin or userId — return status only
	c.JSON(http.StatusOK, gin.H{"status": session.Status})
}

// ConfirmQRRequest is an optional legacy body for POST /v1/auth/qr/:token/confirm.
// PIN/QR pairing binds to the web user at session creation — credentials are not required.
type ConfirmQRRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// confirmQRSession is a shared helper that finalises a QR session for a given user.
// It uses the remaining TTL of the session key, deletes qr:pin:<pin>, updates the
// session to "confirmed" in Redis, creates a MobileRefreshToken in the DB, and
// returns (accessToken, refreshToken, error).
func (h *AuthHandler) confirmQRSession(ctx context.Context, sessionKey string, user *models.User) (string, string, error) {
	// Read raw session bytes
	raw, err := h.redis.Get(ctx, sessionKey).Bytes()
	if err != nil {
		return "", "", err
	}

	var session QRSession
	if err := json.Unmarshal(raw, &session); err != nil {
		return "", "", err
	}

	// Get remaining TTL so we preserve it on the confirmed session
	ttl, err := h.redis.TTL(ctx, sessionKey).Result()
	if err != nil || ttl <= 0 {
		ttl = 10 * time.Minute
	}

	// Delete the PIN reverse-lookup key if present
	if session.PIN != "" {
		h.redis.Del(ctx, "qr:pin:"+session.PIN)
	}

	// Write confirmed session back with remaining TTL
	confirmedSession := QRSession{
		Status:    "confirmed",
		UserID:    user.ID,
		CreatedAt: session.CreatedAt,
	}
	confirmedBytes, err := json.Marshal(confirmedSession)
	if err != nil {
		return "", "", err
	}
	if err := h.redis.Set(ctx, sessionKey, confirmedBytes, ttl).Err(); err != nil {
		return "", "", err
	}

	// Generate a secure random mobile refresh token
	tokenBytes := make([]byte, 64)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", "", err
	}
	mrt := hex.EncodeToString(tokenBytes)

	// Persist MobileRefreshToken in DB
	mobileToken := models.MobileRefreshToken{
		UserID: user.ID,
		Token:  mrt,
	}
	if err := h.db.Create(&mobileToken).Error; err != nil {
		return "", "", err
	}

	// Generate short-lived JWT access token
	tokens, err := h.authService.GenerateTokens(user)
	if err != nil {
		return "", "", err
	}

	return tokens.AccessToken, mrt, nil
}

// issueMobileTokens creates a short-lived access token and non-expiring mobile refresh token.
func (h *AuthHandler) issueMobileTokens(user *models.User) (string, string, error) {
	tokenBytes := make([]byte, 64)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", "", err
	}
	mrt := hex.EncodeToString(tokenBytes)

	mobileToken := models.MobileRefreshToken{
		UserID: user.ID,
		Token:  mrt,
	}
	if err := h.db.Create(&mobileToken).Error; err != nil {
		return "", "", err
	}

	tokens, err := h.authService.GenerateTokens(user)
	if err != nil {
		return "", "", err
	}

	return tokens.AccessToken, mrt, nil
}

// resolveQRSessionUser loads the account bound to a pending QR session.
// Legacy sessions without InitiatorUserID may still supply email/password.
func (h *AuthHandler) resolveQRSessionUser(session *QRSession, req ConfirmQRRequest) (*models.User, int, ErrorResponse) {
	if session.InitiatorUserID > 0 {
		var user models.User
		if err := h.db.First(&user, session.InitiatorUserID).Error; err != nil {
			return nil, http.StatusInternalServerError, ErrorResponse{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to load linked account",
			}
		}
		return &user, 0, ErrorResponse{}
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || req.Password == "" {
		return nil, http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: "This QR session is invalid. Generate a new code from the web dashboard.",
		}
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return nil, http.StatusUnauthorized, ErrorResponse{
			Code:    "INVALID_CREDENTIALS",
			Message: "Invalid email or password",
		}
	}
	if !user.CheckPassword(req.Password) {
		return nil, http.StatusUnauthorized, ErrorResponse{
			Code:    "INVALID_CREDENTIALS",
			Message: "Invalid email or password",
		}
	}
	return &user, 0, ErrorResponse{}
}

// ConfirmQR handles POST /v1/auth/qr/:token/confirm (public — mobile QR scan path).
//
// Flow:
//  1. Read QR session from Redis; missing key → 410 QR_EXPIRED.
//  2. Session already confirmed → 409 QR_ALREADY_USED.
//  3. Validate email + password credentials.
//  4. Delegate to confirmQRSession helper.
//  5. Return { accessToken, refreshToken }.
func (h *AuthHandler) ConfirmQR(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_TOKEN",
			Message: "Token is required",
		})
		return
	}

	ctx := c.Request.Context()
	redisKey := "qr:session:" + token

	// --- 1. Check session exists and is not already confirmed ---
	raw, err := h.redis.Get(ctx, redisKey).Bytes()
	if err == redis.Nil {
		c.JSON(http.StatusGone, ErrorResponse{Code: "QR_EXPIRED", Message: "QR code has expired"})
		return
	}
	if err != nil {
		slog.Error("ConfirmQR: failed to read session", "error", err, "token", token)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to read QR session"})
		return
	}

	var session QRSession
	if err := json.Unmarshal(raw, &session); err != nil {
		slog.Error("ConfirmQR: failed to parse session", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to parse QR session"})
		return
	}
	if session.Status == "confirmed" {
		c.JSON(http.StatusConflict, ErrorResponse{Code: "QR_ALREADY_USED", Message: "This QR code has already been used"})
		return
	}

	// --- 2. Resolve the web user bound to this session ---
	var req ConfirmQRRequest
	_ = c.ShouldBindJSON(&req)
	user, status, errResp := h.resolveQRSessionUser(&session, req)
	if user == nil {
		c.JSON(status, errResp)
		return
	}

	// --- 3. Confirm session and issue tokens ---
	accessToken, refreshToken, err := h.confirmQRSession(ctx, redisKey, user)
	if err != nil {
		slog.Error("ConfirmQR: failed to confirm session", "error", err, "token", token)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to confirm QR session"})
		return
	}

	slog.Info("QR login confirmed", "userID", user.ID, "token", token)
	c.JSON(http.StatusOK, gin.H{"accessToken": accessToken, "refreshToken": refreshToken})
}

// GenerateQR handles POST /v1/auth/qr/generate (JWT-protected).
// Generates a UUID token + cryptographically random 6-digit PIN, stores the pending
// session in Redis with a 10-minute TTL, and returns the token, PIN, and QR image URL.
func (h *AuthHandler) GenerateQR(c *gin.Context) {
	if h.redis == nil {
		slog.Error("GenerateQR: Redis client is nil")
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "QR login is not available",
		})
		return
	}

	// 1. Generate a UUID token
	token := uuid.New().String()

	// 2. Generate cryptographically random 6-digit PIN (zero-padded)
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		slog.Error("GenerateQR: failed to generate PIN", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to generate PIN"})
		return
	}
	pinNum := binary.BigEndian.Uint32(b) % 1000000
	pin := fmt.Sprintf("%06d", pinNum)

	initiatorUserID, _ := c.Get("userID")
	webUserID, _ := initiatorUserID.(uint)

	// 3. Store pending session in Redis with 10-minute TTL
	session := QRSession{
		Status:          "pending",
		PIN:             pin,
		InitiatorUserID: webUserID,
		CreatedAt:       time.Now().Unix(),
	}
	sessionJSON, err := json.Marshal(session)
	if err != nil {
		slog.Error("GenerateQR: failed to marshal session", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create QR session"})
		return
	}

	ctx := c.Request.Context()
	redisKey := "qr:session:" + token
	pinKey := "qr:pin:" + pin

	if err := h.redis.Set(ctx, redisKey, string(sessionJSON), 10*time.Minute).Err(); err != nil {
		slog.Error("GenerateQR: failed to store session in Redis", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create QR session"})
		return
	}

	// Store PIN → token reverse-lookup with same TTL
	if err := h.redis.Set(ctx, pinKey, token, 10*time.Minute).Err(); err != nil {
		slog.Error("GenerateQR: failed to store PIN lookup in Redis", "error", err)
		h.redis.Del(ctx, redisKey)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create QR session"})
		return
	}

	// 4. Build the link-mobile URL
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	qrLoginURL := fmt.Sprintf("%s/link-mobile?token=%s", frontendURL, token)

	// 5. Generate QR code PNG (256×256)
	pngBytes, err := qrcode.Encode(qrLoginURL, qrcode.Medium, 256)
	if err != nil {
		slog.Error("GenerateQR: failed to generate QR code", "error", err)
		h.redis.Del(ctx, redisKey)
		h.redis.Del(ctx, pinKey)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to generate QR code"})
		return
	}

	// 6. Base64-encode PNG and build data URL
	encoded := base64.StdEncoding.EncodeToString(pngBytes)
	qrImageURL := "data:image/png;base64," + encoded

	slog.Info("QR session created", "token", token)

	c.JSON(http.StatusOK, gin.H{
		"token":      token,
		"pin":        pin,
		"qrImageUrl": qrImageURL,
	})
}

// AcceptInvite handles GET /v1/auth/accept-invite?token=<t> (public).
//
// Flow:
//  1. Read token from query param; missing → 400.
//  2. Look up Invite by token; not found → 410 INVITE_EXPIRED.
//  3. Check invite.ExpiresAt > NOW(); expired → 410 INVITE_EXPIRED.
//  4. Find or create User by invite email (placeholder user if new — no password set).
//  5. Create OrganizationMember{OrganizationID, UserID, Role} if not already a member.
//  6. Update invite status to "accepted".
//  7. Return 200 with JWT token pair + user info.
func (h *AuthHandler) AcceptInvite(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "MISSING_TOKEN",
			Message: "Invite token is required",
		})
		return
	}

	// --- 1. Look up invite by token ---
	var invite models.Invite
	if err := h.db.Where("token = ?", token).First(&invite).Error; err != nil {
		// Not found — treat as expired/invalid
		c.JSON(http.StatusGone, ErrorResponse{
			Code:    "INVITE_EXPIRED",
			Message: "This invite link is invalid or has expired",
		})
		return
	}

	// --- 2. Check expiry ---
	if invite.IsExpired() {
		c.JSON(http.StatusGone, ErrorResponse{
			Code:    "INVITE_EXPIRED",
			Message: "This invite link has expired",
		})
		return
	}

	// --- 3. Find or create user by invite email ---
	email := strings.ToLower(strings.TrimSpace(invite.Email))
	var user models.User
	err := h.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		// User doesn't exist — create a placeholder (no password, not verified)
		user = models.User{
			Email:         email,
			Name:          email, // use email as placeholder name
			EmailVerified: false,
		}
		// Set a random unusable password hash so the not-null constraint is satisfied
		randomBytes := make([]byte, 32)
		if _, randErr := rand.Read(randomBytes); randErr == nil {
			user.PasswordHash = hex.EncodeToString(randomBytes)
		}

		if createErr := h.db.Create(&user).Error; createErr != nil {
			slog.Error("AcceptInvite: failed to create placeholder user", "error", createErr, "email", email)
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to create user account",
			})
			return
		}
		slog.Info("AcceptInvite: placeholder user created", "userID", user.ID, "email", email)
	}

	// --- 4. Create OrganizationMember if not already a member ---
	var existingMember models.OrganizationMember
	memberErr := h.db.Where("organization_id = ? AND user_id = ?", invite.OrganizationID, user.ID).
		First(&existingMember).Error
	if memberErr != nil {
		// Not a member yet — create the record
		member := models.OrganizationMember{
			OrganizationID: invite.OrganizationID,
			UserID:         user.ID,
			Role:           invite.Role,
		}
		if createErr := h.db.Create(&member).Error; createErr != nil {
			slog.Error("AcceptInvite: failed to create org member", "error", createErr,
				"orgID", invite.OrganizationID, "userID", user.ID)
			c.JSON(http.StatusInternalServerError, ErrorResponse{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to add user to organization",
			})
			return
		}
		slog.Info("AcceptInvite: org member created", "orgID", invite.OrganizationID, "userID", user.ID, "role", invite.Role)
	}

	// --- 5. Mark invite as accepted ---
	if updateErr := h.db.Model(&invite).Update("status", "accepted").Error; updateErr != nil {
		// Non-fatal: log the error but don't block the response
		slog.Error("AcceptInvite: failed to update invite status", "error", updateErr, "inviteID", invite.ID)
	}

	// --- 6. Generate JWT token pair ---
	tokens, err := h.authService.GenerateTokens(&user)
	if err != nil {
		slog.Error("AcceptInvite: failed to generate tokens", "error", err, "userID", user.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to generate authentication tokens",
		})
		return
	}

	slog.Info("AcceptInvite: invite accepted", "inviteID", invite.ID, "userID", user.ID, "orgID", invite.OrganizationID)

	c.JSON(http.StatusOK, AuthResponse{
		User:   user.ToResponse(),
		Tokens: tokens,
	})
}

// MobileLogin handles POST /v1/auth/mobile-login (public — email/password on device).
// Issues a non-expiring mobile refresh token for WhatsApp-style persistent sessions.
func (h *AuthHandler) MobileLogin(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Code:    "VALIDATION_ERROR",
			Message: err.Error(),
		})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
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

	accessToken, refreshToken, err := h.issueMobileTokens(&user)
	if err != nil {
		slog.Error("MobileLogin: failed to issue tokens", "error", err, "userID", user.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Code:    "INTERNAL_ERROR",
			Message: "Failed to generate authentication tokens",
		})
		return
	}

	slog.Info("Mobile email login", "userID", user.ID)
	c.JSON(http.StatusOK, AuthResponse{
		User: user.ToResponse(),
		Tokens: &services.TokenPair{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
		},
	})
}

// ConfirmQRByPIN handles POST /v1/auth/qr/pin-confirm (public — mobile PIN path).
// Body: { pin }
// Looks up the token via qr:pin:<pin>, then delegates to the shared confirmQRSession helper.
func (h *AuthHandler) ConfirmQRByPIN(c *gin.Context) {
	var req struct {
		PIN string `json:"pin" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}

	ctx := c.Request.Context()
	pinKey := "qr:pin:" + req.PIN

	// Resolve PIN → token
	token, err := h.redis.Get(ctx, pinKey).Result()
	if err == redis.Nil {
		c.JSON(http.StatusGone, ErrorResponse{Code: "QR_EXPIRED", Message: "PIN has expired or does not exist"})
		return
	}
	if err != nil {
		slog.Error("ConfirmQRByPIN: failed to look up PIN", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to look up PIN"})
		return
	}

	redisKey := "qr:session:" + token

	// Check session is still pending
	raw, err := h.redis.Get(ctx, redisKey).Bytes()
	if err == redis.Nil {
		c.JSON(http.StatusGone, ErrorResponse{Code: "QR_EXPIRED", Message: "QR session has expired"})
		return
	}
	if err != nil {
		slog.Error("ConfirmQRByPIN: failed to read session", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to read QR session"})
		return
	}

	var session QRSession
	if err := json.Unmarshal(raw, &session); err != nil {
		slog.Error("ConfirmQRByPIN: failed to parse session", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to parse QR session"})
		return
	}
	if session.Status == "confirmed" {
		c.JSON(http.StatusConflict, ErrorResponse{Code: "QR_ALREADY_USED", Message: "This QR session has already been used"})
		return
	}

	user, status, errResp := h.resolveQRSessionUser(&session, ConfirmQRRequest{})
	if user == nil {
		c.JSON(status, errResp)
		return
	}

	// Confirm session and issue tokens
	accessToken, refreshToken, err := h.confirmQRSession(ctx, redisKey, user)
	if err != nil {
		slog.Error("ConfirmQRByPIN: failed to confirm session", "error", err, "token", token)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to confirm QR session"})
		return
	}

	slog.Info("QR PIN login confirmed", "userID", user.ID, "token", token)
	c.JSON(http.StatusOK, gin.H{"accessToken": accessToken, "refreshToken": refreshToken})
}

// RefreshMobileToken handles POST /v1/auth/refresh (public).
// Body: { refreshToken }
// Looks up the MobileRefreshToken record; if not found or revoked → 401 TOKEN_REVOKED.
// Issues a new short-lived JWT access token.
func (h *AuthHandler) RefreshMobileToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}

	var mrt models.MobileRefreshToken
	if err := h.db.Where("token = ?", req.RefreshToken).First(&mrt).Error; err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Code: "TOKEN_REVOKED", Message: "Refresh token is invalid or revoked"})
		return
	}

	if mrt.Revoked {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Code: "TOKEN_REVOKED", Message: "Refresh token has been revoked"})
		return
	}

	// Load user
	var user models.User
	if err := h.db.First(&user, mrt.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{Code: "TOKEN_REVOKED", Message: "User not found"})
		return
	}

	// Generate new short-lived access token
	tokens, err := h.authService.GenerateTokens(&user)
	if err != nil {
		slog.Error("RefreshMobileToken: failed to generate tokens", "error", err, "userID", user.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to generate access token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"accessToken": tokens.AccessToken})
}

// MobileLogout handles POST /v1/auth/mobile-logout (JWT-protected).
// Body: { refreshToken }
// Finds the MobileRefreshToken record and sets revoked=true.
func (h *AuthHandler) MobileLogout(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}

	var mrt models.MobileRefreshToken
	if err := h.db.Where("token = ?", req.RefreshToken).First(&mrt).Error; err != nil {
		// Not found — treat as already logged out
		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
		return
	}

	if err := h.db.Model(&mrt).Update("revoked", true).Error; err != nil {
		slog.Error("MobileLogout: failed to revoke token", "error", err, "tokenID", mrt.ID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to revoke token"})
		return
	}

	userID, _ := c.Get("userID")
	slog.Info("Mobile token revoked", "userID", userID, "tokenID", mrt.ID)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// Ensure models import is used (models.User is already used elsewhere in this file).
var _ = models.User{}
