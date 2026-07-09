package notification

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/mosesedem/logstack/internal/config"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/gorm"
)

type Service struct {
	email   *EmailNotifier
	push    *PushNotifier
	webhook *WebhookNotifier
}

// PartialDeliveryError means at least one channel succeeded and at least one failed.
// Alert processing keeps cooldown (email already went out) but history and test
// endpoints can surface the push/webhook failure instead of pretending full success.
type PartialDeliveryError struct {
	Succeeded []string
	Failed    []string
	Errs      []error
}

func (e *PartialDeliveryError) Error() string {
	return fmt.Sprintf(
		"partial delivery: ok=[%s] failed=[%s]: %v",
		strings.Join(e.Succeeded, ","),
		strings.Join(e.Failed, ","),
		errors.Join(e.Errs...),
	)
}

func (e *PartialDeliveryError) Unwrap() error {
	return errors.Join(e.Errs...)
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
		slog.Info("push notifier enabled", "firebase_project_id", cfg.FCMProjectID, "path", cfg.FCMServiceAccountPath)
	} else {
		slog.Warn("push notifier disabled — set FCM_SERVICE_ACCOUNT_PATH (path to firebase service account JSON) and optionally FCM_PROJECT_ID in .env. Without this only email/webhook alerts will work. For iOS push you must ALSO upload an APNs key in the Firebase Console.")
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

// GetPushNotifier returns the push notifier for direct delivery (e.g. escalations).
func (s *Service) GetPushNotifier() *PushNotifier {
	return s.push
}

func (s *Service) Send(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
	channels := channelsForRule(rule)
	if len(channels) == 0 {
		return fmt.Errorf("no alert channels configured")
	}

	var (
		errs      []error
		succeeded []string
		failed    []string
	)
	for _, channel := range channels {
		channelRule := *rule
		channelRule.Channel = channel
		if err := s.sendChannel(ctx, &channelRule, log); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", channel, err))
			failed = append(failed, string(channel))
			slog.Error("alert channel delivery failed",
				"channel", channel,
				"ruleId", rule.ID,
				"error", err,
			)
			continue
		}
		succeeded = append(succeeded, string(channel))
		slog.Info("alert channel delivery ok",
			"channel", channel,
			"ruleId", rule.ID,
		)
	}

	if len(errs) == 0 {
		return nil
	}
	if len(succeeded) > 0 {
		return &PartialDeliveryError{
			Succeeded: succeeded,
			Failed:    failed,
			Errs:      errs,
		}
	}
	return errors.Join(errs...)
}

func channelsForRule(rule *models.AlertRule) []models.AlertChannel {
	if len(rule.Channels) > 0 {
		channels := make([]models.AlertChannel, 0, len(rule.Channels))
		seen := make(map[string]struct{}, len(rule.Channels))
		for _, ch := range rule.Channels {
			name := strings.TrimSpace(ch)
			if name == "" {
				continue
			}
			if _, ok := seen[name]; ok {
				continue
			}
			seen[name] = struct{}{}
			channels = append(channels, models.AlertChannel(name))
		}
		if len(channels) > 0 {
			return channels
		}
	}
	if rule.Channel != "" {
		return []models.AlertChannel{rule.Channel}
	}
	return nil
}

func (s *Service) sendChannel(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
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
