package notification

import (
	"context"
	"fmt"

	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

type Service struct {
	email   *EmailNotifier
	push    *PushNotifier
	webhook *WebhookNotifier
}

func NewNotificationService(brevoAPIKey, fcmServiceAccountPath, fcmProjectID, baseURL string) *Service {
	return &Service{
		email:   NewEmailNotifier(brevoAPIKey, baseURL),
		webhook: NewWebhookNotifier(),
	}
}

func NewNotificationServiceWithDB(brevoAPIKey, fcmServiceAccountPath, fcmProjectID, baseURL string, db *gorm.DB) *Service {
	push, err := NewPushNotifier(fcmServiceAccountPath, fcmProjectID, db)
	if err != nil {
		// Log error but don't fail - push notifications will just be disabled
		fmt.Printf("Warning: Failed to initialize push notifier: %v\n", err)
		push = nil
	}
	
	return &Service{
		email:   NewEmailNotifier(brevoAPIKey, baseURL),
		push:    push,
		webhook: NewWebhookNotifier(),
	}
}

// GetEmailNotifier returns the email notifier for direct use
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
