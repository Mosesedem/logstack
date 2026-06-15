package notification

import (
	"context"
	"fmt"
	"log/slog"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"github.com/mosesedem/logstack/internal/models"
	"google.golang.org/api/option"
	"gorm.io/gorm"
)

type PushNotifier struct {
	client *messaging.Client
	db     *gorm.DB
}

// NewPushNotifier creates a new push notifier using Firebase Admin SDK with HTTP v1 API.
// serviceAccountPath: Path to the Firebase service account JSON file
// projectID: Firebase project ID (optional, can be inferred from service account)
func NewPushNotifier(serviceAccountPath string, projectID string, db *gorm.DB) (*PushNotifier, error) {
	if serviceAccountPath == "" {
		slog.Warn("FCM service account path not configured, push notifications will be disabled")
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

func (p *PushNotifier) Send(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
	if p.client == nil {
		return fmt.Errorf("FCM client not initialized")
	}

	// Get push tokens for the recipient (user ID)
	var tokens []models.PushToken
	if err := p.db.Where("user_id = ?", rule.Recipient).Find(&tokens).Error; err != nil {
		return fmt.Errorf("failed to fetch push tokens: %w", err)
	}

	if len(tokens) == 0 {
		return fmt.Errorf("no push tokens found for user")
	}

	title := fmt.Sprintf("Logstack Alert: %s", rule.Name)
	body := fmt.Sprintf("[%s] %s", log.Level, truncate(log.Message, 100))

	// Send to all tokens
	successCount := 0
	for _, token := range tokens {
		message := &messaging.Message{
			Token: token.Token,
			Notification: &messaging.Notification{
				Title: title,
				Body:  body,
			},
			Data: map[string]string{
				"logId":     fmt.Sprintf("%d", log.ID),
				"projectId": log.ProjectID.String(),
				"ruleId":    fmt.Sprintf("%d", rule.ID),
				"level":     string(log.Level),
			},
			Android: &messaging.AndroidConfig{
				Priority: "high",
				Notification: &messaging.AndroidNotification{
					Sound: "default",
					Priority: messaging.PriorityHigh,
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

		// Send message using FCM HTTP v1 API
		response, err := p.client.Send(ctx, message)
		if err != nil {
			slog.Error("Failed to send push notification",
				"token", maskToken(token.Token),
				"error", err,
			)
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
