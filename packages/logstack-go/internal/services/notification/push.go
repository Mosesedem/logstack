package notification

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"github.com/mosesedem/logstack/internal/models"
	"google.golang.org/api/option"
	"gorm.io/gorm"
)

// fcmClient is an interface for the Firebase messaging client, allowing test injection.
type fcmClient interface {
	Send(ctx context.Context, msg *messaging.Message) (string, error)
}

type PushNotifier struct {
	client           fcmClient
	db               *gorm.DB
	// isInvalidTokenErr overrides the Firebase error check in tests.
	// When nil, the production check (messaging.IsRegistrationTokenNotRegistered || messaging.IsInvalidArgument) is used.
	isInvalidTokenErr func(error) bool
}

// NewPushNotifier creates a new push notifier using Firebase Admin SDK with HTTP v1 API.
// serviceAccountPath: Path to the Firebase service account JSON file
// projectID: Firebase project ID (optional, can be inferred from service account)
func NewPushNotifier(serviceAccountPath string, projectID string, db *gorm.DB) (*PushNotifier, error) {
	if serviceAccountPath == "" {
		slog.Warn("FCM service account path not configured (FCM_SERVICE_ACCOUNT_PATH), push notifications will be disabled. Server-side alerts and escalations via push will not be sent.")
		return &PushNotifier{db: db}, nil
	}

	ctx := context.Background()
	
	// Initialize Firebase app with service account
	opt := option.WithCredentialsFile(serviceAccountPath)
	config := &firebase.Config{ProjectID: projectID}
	
	app, err := firebase.NewApp(ctx, config, opt)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Firebase app: %w", err)
	}

	// Get messaging client
	client, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get Firebase messaging client: %w", err)
	}

	slog.Info("Firebase Cloud Messaging initialized with HTTP v1 API")
	
	return &PushNotifier{
		client: client,
		db:     db,
	}, nil
}

// buildFCMMessage constructs a Firebase messaging.Message with the correct
// iOS (APNS) and Android priority settings for reliable delivery.
func buildFCMMessage(token string, title, body string, data map[string]string) *messaging.Message {
	return &messaging.Message{
		Token: token,
		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},
		Data: data,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				ChannelID: "logstack_alerts_default",
				Sound:     "default",
				Priority:  messaging.PriorityHigh,
			},
		},
		APNS: &messaging.APNSConfig{
			Headers: map[string]string{
				"apns-priority": "10",
			},
			Payload: &messaging.APNSPayload{
				Aps: &messaging.Aps{
					Sound: "default",
				},
			},
		},
	}
}

// SendDirect delivers a push notification to every device registered for [userID].
func (p *PushNotifier) SendDirect(
	ctx context.Context,
	userID uint,
	title, body string,
	data map[string]string,
) error {
	if p.client == nil {
		return fmt.Errorf("FCM client not initialized")
	}

	var tokens []models.PushToken
	if err := p.db.Where("user_id = ?", userID).Find(&tokens).Error; err != nil {
		return fmt.Errorf("failed to fetch push tokens: %w", err)
	}
	if len(tokens) == 0 {
		return fmt.Errorf("no push tokens found for user")
	}

	checker := p.isInvalidTokenErr
	if checker == nil {
		checker = func(err error) bool {
			return messaging.IsRegistrationTokenNotRegistered(err) || messaging.IsInvalidArgument(err)
		}
	}

	successCount := 0
	for _, token := range tokens {
		message := buildFCMMessage(token.Token, title, body, data)
		response, err := p.client.Send(ctx, message)
		if err != nil {
			if checker(err) {
				p.db.Where("token = ?", token.Token).Delete(&models.PushToken{})
			}
			continue
		}
		slog.Info("direct push sent", "userId", userID, "messageId", response)
		successCount++
	}

	if successCount == 0 {
		return fmt.Errorf("failed to send notifications to any device")
	}
	return nil
}

func (p *PushNotifier) Send(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
	if p.client == nil {
		return fmt.Errorf("FCM client not initialized")
	}

	userID, err := p.resolveUserID(rule, log)
	if err != nil {
		return err
	}

	var tokens []models.PushToken
	if err := p.db.Where("user_id = ?", userID).Find(&tokens).Error; err != nil {
		return fmt.Errorf("failed to fetch push tokens: %w", err)
	}

	if len(tokens) == 0 {
		return fmt.Errorf("no push tokens found for user")
	}

	title := fmt.Sprintf("Logstack Alert: %s", rule.Name)
	body := fmt.Sprintf("[%s] %s", log.Level, truncate(log.Message, 100))

	// Resolve invalid-token checker: use injected one in tests, real SDK functions in production.
	checker := p.isInvalidTokenErr
	if checker == nil {
		checker = func(err error) bool {
			return messaging.IsRegistrationTokenNotRegistered(err) || messaging.IsInvalidArgument(err)
		}
	}

	// Send to all tokens
	successCount := 0
	for _, token := range tokens {
		data := map[string]string{
			"logId":     fmt.Sprintf("%d", log.ID),
			"projectId": log.ProjectID.String(),
			"ruleId":    fmt.Sprintf("%d", rule.ID),
			"level":     string(log.Level),
		}
		message := buildFCMMessage(token.Token, title, body, data)

		// Send message using FCM HTTP v1 API
		response, err := p.client.Send(ctx, message)
		if err != nil {
			if checker(err) {
				p.db.Where("token = ?", token.Token).Delete(&models.PushToken{})
				slog.Warn("deleted stale push token",
					"token", maskToken(token.Token),
					"error", err,
					"token_removed", true,
				)
			} else {
				slog.Error("push send failed",
					"token", maskToken(token.Token),
					"error", err,
					"token_removed", false,
				)
			}
			continue
		}

		slog.Info("Push notification sent successfully",
			"token", maskToken(token.Token),
			"messageId", response,
		)
		successCount++
	}

	if successCount == 0 {
		return fmt.Errorf("failed to send notifications to any device")
	}

	slog.Info("Push notifications sent",
		"total", len(tokens),
		"successful", successCount,
	)

	return nil
}

// resolveUserID returns the push recipient user ID. When the rule recipient is
// an email address (common for multi-channel rules), fall back to the project owner.
func (p *PushNotifier) resolveUserID(rule *models.AlertRule, log *models.Log) (uint, error) {
	if id, err := strconv.ParseUint(rule.Recipient, 10, 32); err == nil {
		return uint(id), nil
	}

	var project models.Project
	if err := p.db.Where("id = ?", log.ProjectID).First(&project).Error; err != nil {
		return 0, fmt.Errorf("failed to resolve push recipient from project: %w", err)
	}

	return project.OwnerID, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func maskToken(token string) string {
	if len(token) <= 20 {
		return "***"
	}
	return token[:10] + "..." + token[len(token)-10:]
}
