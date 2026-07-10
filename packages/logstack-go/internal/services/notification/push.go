package notification

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

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
	client fcmClient
	db     *gorm.DB
	email  *EmailNotifier
	// isInvalidTokenErr overrides the Firebase error check in tests.
	// When nil, the production check (messaging.IsRegistrationTokenNotRegistered || messaging.IsInvalidArgument) is used.
	isInvalidTokenErr func(error) bool
}

// SetEmailNotifier wires the email notifier used for ops alerts on push failures.
func (p *PushNotifier) SetEmailNotifier(email *EmailNotifier) {
	if p == nil {
		return
	}
	p.email = email
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

	slog.Info("Firebase Cloud Messaging initialized with HTTP v1 API", "projectId", projectID)

	return &PushNotifier{
		client: client,
		db:     db,
	}, nil
}

// IsEnabled reports whether FCM is wired with a live messaging client.
func (p *PushNotifier) IsEnabled() bool {
	return p != nil && p.client != nil
}

func normalizeDeviceType(deviceType models.DeviceType) models.DeviceType {
	switch strings.ToLower(strings.TrimSpace(string(deviceType))) {
	case string(models.DeviceTypeAndroid):
		return models.DeviceTypeAndroid
	case string(models.DeviceTypeIOS), "iphone", "apple":
		return models.DeviceTypeIOS
	default:
		slog.Warn("unknown push token device type, using iOS-safe payload", "deviceType", deviceType)
		return models.DeviceTypeIOS
	}
}

// buildFCMMessage constructs a per-platform Firebase message.
//
// iOS: notification-only — byte-for-byte the same shape Firebase Console uses.
// Do not add Data or APNS overrides; FCM maps Notification → APNs and custom
// blocks caused "FCM accepted, nothing on device" on iOS.
//
// Android: notification + data + high-priority channel for reliable delivery.
func buildFCMMessage(
	deviceType models.DeviceType,
	token, title, body string,
	data map[string]string,
) *messaging.Message {
	deviceType = normalizeDeviceType(deviceType)

	if deviceType == models.DeviceTypeIOS {
		return &messaging.Message{
			Token: token,
			Notification: &messaging.Notification{
				Title: truncateUTF8Bytes(title, 200),
				Body:  truncateUTF8Bytes(body, 1500),
			},
		}
	}

	payload := map[string]string{
		"title": title,
		"body":  body,
	}
	for k, v := range data {
		if k == "" {
			continue
		}
		payload[k] = v
	}

	return &messaging.Message{
		Token: token,
		Notification: &messaging.Notification{
			Title: title,
			Body:  body,
		},
		Data: payload,
		Android: &messaging.AndroidConfig{
			Priority: "high",
			Notification: &messaging.AndroidNotification{
				// Must match the channel created by the mobile app
				// (NotificationService: logstack_alerts_default).
				ChannelID:             "logstack_alerts_default",
				Icon:                  "ic_launcher_monochrome",
				Color:                 "#3B82F6",
				Sound:                 "default",
				Priority:              messaging.PriorityHigh,
				DefaultSound:          true,
				DefaultVibrateTimings: true,
			},
		},
	}
}

func truncateUTF8Bytes(s string, maxBytes int) string {
	if maxBytes <= 0 {
		return ""
	}
	b := []byte(s)
	if len(b) <= maxBytes {
		return s
	}
	cut := maxBytes
	for cut > 0 && b[cut]&0xC0 == 0x80 {
		cut--
	}
	return string(b[:cut]) + "..."
}

// DirectPushResult summarizes a SendDirect attempt for admin diagnostics.
type DirectPushResult struct {
	TokensFound   int
	Sent          int
	Failed        int
	IOSTokens     int
	IOSSent       int
	IOSFailed     int
	AndroidTokens int
	AndroidSent   int
	AndroidFailed int
	Errors        []string
}

// SendDirect delivers a push notification to every device registered for [userID].
func (p *PushNotifier) SendDirect(
	ctx context.Context,
	userID uint,
	title, body string,
	data map[string]string,
) error {
	_, err := p.SendDirectDetailed(ctx, userID, title, body, data)
	return err
}

// SendDirectDetailed is like SendDirect but returns token/send diagnostics.
func (p *PushNotifier) SendDirectDetailed(
	ctx context.Context,
	userID uint,
	title, body string,
	data map[string]string,
) (*DirectPushResult, error) {
	result := &DirectPushResult{}
	source := pushSourceFromData(data)

	reportErr := func(err error) (*DirectPushResult, error) {
		ReportPushFailure(ctx, p.email, source, userID, title, body, err, result)
		return result, err
	}

	if p.client == nil {
		return reportErr(fmt.Errorf("FCM client not initialized — set FCM_SERVICE_ACCOUNT_PATH on the API (and ensure the service account JSON is mounted in production)"))
	}

	var tokens []models.PushToken
	if err := p.db.Where("user_id = ?", userID).Find(&tokens).Error; err != nil {
		return reportErr(fmt.Errorf("failed to fetch push tokens: %w", err))
	}
	tokens = latestTokensPerDevice(tokens)
	result.TokensFound = len(tokens)
	if len(tokens) == 0 {
		return reportErr(fmt.Errorf("no push tokens for user %d — open the Logstack mobile app signed in as this user, grant notification permission, and confirm Settings shows push registered", userID))
	}

	checker := p.isInvalidTokenErr
	if checker == nil {
		checker = func(err error) bool {
			return messaging.IsRegistrationTokenNotRegistered(err) || messaging.IsInvalidArgument(err)
		}
	}

	for _, token := range tokens {
		deviceType := normalizeDeviceType(token.DeviceType)
		switch deviceType {
		case models.DeviceTypeIOS:
			result.IOSTokens++
		case models.DeviceTypeAndroid:
			result.AndroidTokens++
		}

		message := buildFCMMessage(deviceType, token.Token, title, body, data)
		response, err := p.client.Send(ctx, message)
		if err != nil {
			result.Failed++
			switch deviceType {
			case models.DeviceTypeIOS:
				result.IOSFailed++
			case models.DeviceTypeAndroid:
				result.AndroidFailed++
			}
			errMsg := err.Error()
			if checker(err) {
				if delErr := p.db.Where("token = ?", token.Token).Delete(&models.PushToken{}).Error; delErr != nil {
					slog.Warn("failed to delete stale push token", "error", delErr)
				}
				slog.Warn("deleted stale push token",
					"userId", userID,
					"deviceType", token.DeviceType,
					"token", maskToken(token.Token),
					"error", err,
					"token_removed", true,
				)
				result.Errors = append(result.Errors, fmt.Sprintf("%s token invalid/stale: %s", token.DeviceType, errMsg))
			} else {
				slog.Error("push send failed",
					"userId", userID,
					"deviceType", token.DeviceType,
					"token", maskToken(token.Token),
					"error", err,
					"token_removed", false,
				)
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %s", token.DeviceType, errMsg))
			}
			continue
		}
		result.Sent++
		switch deviceType {
		case models.DeviceTypeIOS:
			result.IOSSent++
		case models.DeviceTypeAndroid:
			result.AndroidSent++
		}
		slog.Info("direct push sent",
			"userId", userID,
			"deviceType", token.DeviceType,
			"messageId", response,
			"token", maskToken(token.Token),
		)
	}

	if result.Sent == 0 {
		detail := "failed to send to any device"
		if len(result.Errors) > 0 {
			detail = detail + ": " + strings.Join(result.Errors, "; ")
		}
		return reportErr(fmt.Errorf("%s", detail))
	}
	if result.Failed > 0 {
		partialErr := fmt.Errorf(
			"partial device delivery: sent=%d failed=%d (ios %d/%d, android %d/%d): %s",
			result.Sent,
			result.Failed,
			result.IOSSent,
			result.IOSTokens,
			result.AndroidSent,
			result.AndroidTokens,
			strings.Join(result.Errors, "; "),
		)
		ReportPushFailure(ctx, p.email, source, userID, title, body, partialErr, result)
		return result, partialErr
	}
	return result, nil
}

func (p *PushNotifier) Send(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
	if p.client == nil {
		return fmt.Errorf("FCM client not initialized — set FCM_SERVICE_ACCOUNT_PATH on the API to a valid Firebase service account JSON (must match the mobile app's Firebase project)")
	}

	userID, err := p.resolveUserID(rule, log)
	if err != nil {
		return err
	}

	title := fmt.Sprintf("Logstack Alert: %s", rule.Name)
	body := fmt.Sprintf("[%s] %s", log.Level, truncate(log.Message, 100))
	data := map[string]string{
		"logId":     fmt.Sprintf("%d", log.ID),
		"projectId": log.ProjectID.String(),
		"ruleId":    fmt.Sprintf("%d", rule.ID),
		"level":     string(log.Level),
		"type":      "alert",
	}

	_, err = p.SendDirectDetailed(ctx, userID, title, body, data)
	return err
}

// resolveUserID returns the push recipient user ID. When the rule recipient is
// an email address (common for multi-channel rules), fall back to the project owner.
func (p *PushNotifier) resolveUserID(rule *models.AlertRule, log *models.Log) (uint, error) {
	if id, err := strconv.ParseUint(strings.TrimSpace(rule.Recipient), 10, 32); err == nil {
		return uint(id), nil
	}

	recipient := strings.TrimSpace(rule.Recipient)
	if strings.Contains(recipient, "@") {
		var user models.User
		if err := p.db.Where("LOWER(email) = ?", strings.ToLower(recipient)).First(&user).Error; err == nil {
			return user.ID, nil
		}
	}

	var project models.Project
	if err := p.db.Where("id = ?", log.ProjectID).First(&project).Error; err != nil {
		return 0, fmt.Errorf("failed to resolve push recipient from project: %w", err)
	}

	return project.OwnerID, nil
}

// latestTokensPerDevice keeps only the newest token per platform so stale iOS
// tokens (e.g. from an old debug build) do not shadow the current TestFlight token.
func latestTokensPerDevice(tokens []models.PushToken) []models.PushToken {
	if len(tokens) <= 1 {
		return tokens
	}

	latest := make(map[models.DeviceType]models.PushToken)
	for _, token := range tokens {
		dt := normalizeDeviceType(token.DeviceType)
		token.DeviceType = dt
		prev, ok := latest[dt]
		if !ok || token.UpdatedAt.After(prev.UpdatedAt) ||
			(token.UpdatedAt.Equal(prev.UpdatedAt) && token.CreatedAt.After(prev.CreatedAt)) {
			latest[dt] = token
		}
	}

	out := make([]models.PushToken, 0, len(latest))
	for _, token := range latest {
		out = append(out, token)
	}
	return out
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
