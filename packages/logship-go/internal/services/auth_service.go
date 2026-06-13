package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrExpiredToken     = errors.New("token has expired")
	ErrRevokedToken     = errors.New("token has been revoked")
	ErrInvalidSignature = errors.New("invalid token signature")
)

type AuthService struct {
	jwtSecret          []byte
	redis              *redis.Client
	accessTokenExpiry  time.Duration
	refreshTokenExpiry time.Duration
}

type AuthServiceConfig struct {
	JWTSecret          string
	Redis              *redis.Client
	AccessTokenExpiry  time.Duration
	RefreshTokenExpiry time.Duration
}

func NewAuthService(cfg AuthServiceConfig) *AuthService {
	return &AuthService{
		jwtSecret:          []byte(cfg.JWTSecret),
		redis:              cfg.Redis,
		accessTokenExpiry:  cfg.AccessTokenExpiry,
		refreshTokenExpiry: cfg.RefreshTokenExpiry,
	}
}

type Claims struct {
	UserID    uint   `json:"userId"`
	Email     string `json:"email"`
	TokenType string `json:"tokenType"` // "access" or "refresh"
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
	TokenType    string `json:"tokenType"`
}

func (s *AuthService) GenerateTokens(user *models.User) (*TokenPair, error) {
	// Access token
	accessExpiry := time.Now().Add(s.accessTokenExpiry)
	accessClaims := Claims{
		UserID:    user.ID,
		Email:     user.Email,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(accessExpiry),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   fmt.Sprintf("%d", user.ID),
			Issuer:    "logstack",
			ID:        generateTokenID(),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh token
	refreshExpiry := time.Now().Add(s.refreshTokenExpiry)
	refreshClaims := Claims{
		UserID:    user.ID,
		Email:     user.Email,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExpiry),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   fmt.Sprintf("%d", user.ID),
			Issuer:    "logstack",
			ID:        generateTokenID(),
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresAt:    accessExpiry.Unix(),
		TokenType:    "Bearer",
	}, nil
}

func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidSignature
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	// Validate issuer
	if claims.Issuer != "logstack" {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

func (s *AuthService) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != "refresh" {
		return nil, errors.New("not a refresh token")
	}

	return claims, nil
}

func (s *AuthService) RefreshTokens(refreshToken string, db *gorm.DB) (*TokenPair, error) {
	claims, err := s.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, err
	}

	// Check if token is blacklisted
	if s.IsTokenBlacklisted(context.Background(), refreshToken) {
		return nil, ErrRevokedToken
	}

	var user models.User
	if err := db.First(&user, claims.UserID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Blacklist the old refresh token
	if err := s.BlacklistToken(context.Background(), refreshToken, s.refreshTokenExpiry); err != nil {
		// Log error but continue - token rotation is best effort
	}

	return s.GenerateTokens(&user)
}

// BlacklistToken adds a token to the blacklist
func (s *AuthService) BlacklistToken(ctx context.Context, token string, expiry time.Duration) error {
	if s.redis == nil {
		return nil // Skip if redis is not configured
	}

	key := s.getBlacklistKey(token)
	return s.redis.Set(ctx, key, "1", expiry).Err()
}

// IsTokenBlacklisted checks if a token is blacklisted
func (s *AuthService) IsTokenBlacklisted(ctx context.Context, token string) bool {
	if s.redis == nil {
		// Fail closed if Redis is not configured - security first
		return true
	}

	key := s.getBlacklistKey(token)
	exists, err := s.redis.Exists(ctx, key).Result()
	if err != nil {
		// Fail closed if Redis is down - security first
		// Log the error for monitoring
		return true
	}
	return exists > 0
}

// RevokeAllUserTokens invalidates all tokens for a user by storing a "revoked after" timestamp
func (s *AuthService) RevokeAllUserTokens(ctx context.Context, userID uint) error {
	if s.redis == nil {
		return nil
	}

	key := fmt.Sprintf("user:revoked_at:%d", userID)
	return s.redis.Set(ctx, key, time.Now().Unix(), s.refreshTokenExpiry).Err()
}

// GetAccessTokenExpiry returns the configured access token expiry duration
func (s *AuthService) GetAccessTokenExpiry() time.Duration {
	return s.accessTokenExpiry
}

// GetRefreshTokenExpiry returns the configured refresh token expiry duration
func (s *AuthService) GetRefreshTokenExpiry() time.Duration {
	return s.refreshTokenExpiry
}

// GenerateResetToken generates a password reset token for the given email
func (s *AuthService) GenerateResetToken(ctx context.Context, email string) (string, error) {
	if s.redis == nil {
		return "", errors.New("redis is required for password reset")
	}

	token := generateTokenID()
	key := fmt.Sprintf("reset_token:%s", token)

	// Store email in redis with 1 hour expiration
	if err := s.redis.Set(ctx, key, email, time.Hour).Err(); err != nil {
		return "", err
	}

	return token, nil
}

// ValidateResetToken validates the reset token and returns the associated email
func (s *AuthService) ValidateResetToken(ctx context.Context, token string) (string, error) {
	if s.redis == nil {
		return "", errors.New("redis is required for password reset")
	}

	key := fmt.Sprintf("reset_token:%s", token)
	email, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", ErrInvalidToken
	}
	if err != nil {
		return "", err
	}

	return email, nil
}

// InvalidateResetToken removes the reset token
func (s *AuthService) InvalidateResetToken(ctx context.Context, token string) error {
	if s.redis == nil {
		return nil
	}
	key := fmt.Sprintf("reset_token:%s", token)
	return s.redis.Del(ctx, key).Err()
}

// getBlacklistKey generates a unique key for the blacklist
func (s *AuthService) getBlacklistKey(token string) string {
	hash := sha256.Sum256([]byte(token))
	return "blacklist:" + hex.EncodeToString(hash[:])
}

// generateTokenID creates a unique token identifier
func generateTokenID() string {
	hash := sha256.Sum256([]byte(time.Now().String()))
	return hex.EncodeToString(hash[:16])
}
