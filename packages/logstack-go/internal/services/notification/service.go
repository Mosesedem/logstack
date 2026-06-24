package notification

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/mosesedem/logstack/internal/config"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

type Service struct {
	email   *EmailNotifier
	push    *PushNotifier
	webhook *WebhookNotifier
}

// NewNotificationService creates a Service without a database (no push support).
// Deprecated: prefer NewNotificationServiceWithDB.
func NewNotificationService(cfg *config.Config) *Service {
	return &Service{
		email:   NewEmailNotifier(cfg, cfg.BaseURL),
		webhook: NewWebhookNotifier(),
	}
}

// NewNotificationServiceWithDB creates a fully-wired Service with email, push, and webhook support.
func NewNotificationServiceWithDB(cfg *config.Config, db *gorm.DB) *Service {
	email := NewEmailNotifier(cfg, cfg.BaseURL)

	push, err := NewPushNotifier(cfg.FCMServiceAccountPath, cfg.FCMProjectID, db)
	if err != nil {
		slog.Warn("push notifier disabled", "error", err)
		push = nil
	}

	if push != nil && push.client != nil {
		slog.Info("push notifier enabled", "firebase_project_id", cfg.FCMProjectID)
	} else {
		slog.Warn("push notifier disabled: FCM_SERVICE_ACCOUNT_PATH not set or invalid")
	}

	return &Service{
		email:   email,
		push:    push,
		webhook: NewWebhookNotifier(),
	}
}

// GetEmailNotifier returns the email notifier for direct use by auth handlers,
// usage-limit middleware, and organisation handlers.
func (s *Service) GetEmailNotifier() *EmailNotifier {
	return s.email
}

func (s *Service) Send(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
	switch rule.Channel {
	case models.AlertChannelEmail:
		return s.email.Send(ctx, rule, log)
	case models.AlertChannelPush:
		if s.push == nil {
			return fmt.Errorf("push notifier not initialized")
		}
		return s.push.Send(ctx, rule, log)
	case models.AlertChannelWebhook:
		return s.webhook.Send(ctx, rule, log)
	default:
		return fmt.Errorf("unknown alert channel: %s", rule.Channel)
	}
}
