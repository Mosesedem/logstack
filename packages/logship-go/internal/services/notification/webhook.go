package notification

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/mosesedem/logstack/internal/models"
)

type WebhookNotifier struct {
	client *http.Client
}

type WebhookPayload struct {
	AlertID     uint              `json:"alertId"`
	RuleName    string            `json:"ruleName"`
	Log         *models.Log       `json:"log"`
	TriggeredAt time.Time         `json:"triggeredAt"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

func NewWebhookNotifier() *WebhookNotifier {
	return &WebhookNotifier{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (w *WebhookNotifier) Send(ctx context.Context, rule *models.AlertRule, log *models.Log) error {
	payload := WebhookPayload{
		AlertID:     rule.ID,
		RuleName:    rule.Name,
		Log:         log,
		TriggeredAt: time.Now().UTC(),
		Metadata: map[string]string{
			"projectId": log.ProjectID.String(),
			"level":     string(log.Level),
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Retry with exponential backoff (3 attempts)
	maxRetries := 3
	baseDelay := 1 * time.Second

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			delay := baseDelay * time.Duration(1<<uint(attempt-1)) // 1s, 2s, 4s
			slog.Info("Retrying webhook", "attempt", attempt+1, "delay", delay)
			time.Sleep(delay)
		}

		req, err := http.NewRequestWithContext(ctx, "POST", rule.Recipient, bytes.NewBuffer(jsonData))
		if err != nil {
			return fmt.Errorf("failed to create webhook request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "Logstack-Webhook/1.0")
		req.Header.Set("User-Agent", "Logstack-Webhook/1.0")
		req.Header.Set("X-Logstack-Event", "alert.triggered")
		req.Header.Set("X-Logstack-Alert-ID", fmt.Sprintf("%d", rule.ID))

		resp, err := w.client.Do(req)
		if err != nil {
			slog.Warn("Webhook request failed", "url", rule.Recipient, "attempt", attempt+1, "error", err)
			if attempt == maxRetries-1 {
				return fmt.Errorf("webhook failed after %d attempts: %w", maxRetries, err)
			}
			continue
		}

		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			slog.Info("Webhook sent successfully", "url", rule.Recipient, "status", resp.StatusCode)
			return nil
		}

		slog.Warn("Webhook returned non-2xx status", "url", rule.Recipient, "status", resp.StatusCode, "attempt", attempt+1)
		if attempt == maxRetries-1 {
			return fmt.Errorf("webhook failed with status %d after %d attempts", resp.StatusCode, maxRetries)
		}
	}

	return fmt.Errorf("webhook failed after %d attempts", maxRetries)
}
