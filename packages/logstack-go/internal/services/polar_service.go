package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const polarAPIBaseURL = "https://api.polar.sh"

// PolarService handles Polar.sh payment integration for international (USD) customers.
type PolarService struct {
	db         *gorm.DB
	accessToken string
	webhookSecret string
	productIDs map[models.SubscriptionTier]string
	httpClient *http.Client
}

// PolarConfig holds Polar integration settings.
type PolarConfig struct {
	AccessToken   string
	WebhookSecret string
	ProductStarter string
	ProductPro     string
}

// NewPolarService creates a Polar billing service. Returns nil when not configured.
func NewPolarService(db *gorm.DB, cfg PolarConfig) *PolarService {
	if cfg.AccessToken == "" {
		return nil
	}
	return &PolarService{
		db:           db,
		accessToken:  cfg.AccessToken,
		webhookSecret: cfg.WebhookSecret,
		productIDs: map[models.SubscriptionTier]string{
			models.TierStarter: cfg.ProductStarter,
			models.TierPro:     cfg.ProductPro,
		},
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *PolarService) IsConfigured() bool {
	return s != nil && s.accessToken != ""
}

type polarCheckoutCreateRequest struct {
	Products           []string          `json:"products"`
	CustomerEmail      string            `json:"customer_email"`
	CustomerName       string            `json:"customer_name,omitempty"`
	ExternalCustomerID string            `json:"external_customer_id,omitempty"`
	SuccessURL         string            `json:"success_url"`
	ReturnURL          string            `json:"return_url,omitempty"`
	Metadata           map[string]string `json:"metadata,omitempty"`
}

type polarCheckoutResponse struct {
	URL    string `json:"url"`
	ID     string `json:"id"`
	Status string `json:"status"`
}

type polarWebhookEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type polarSubscriptionData struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	CustomerID string `json:"customer_id"`
	ProductID  string `json:"product_id"`
	Amount     int    `json:"amount"`
	Currency   string `json:"currency"`
	CurrentPeriodEnd string `json:"current_period_end"`
	Metadata   map[string]string `json:"metadata"`
}

type polarOrderData struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	Amount     int    `json:"amount"`
	Currency   string `json:"currency"`
	CustomerID string `json:"customer_id"`
	Metadata   map[string]string `json:"metadata"`
}

// InitializeCheckout creates a Polar checkout session for a subscription tier.
func (s *PolarService) InitializeCheckout(ctx context.Context, user *models.User, tier models.SubscriptionTier, successURL, returnURL string) (*InitializePaymentResponse, error) {
	productID, ok := s.productIDs[tier]
	if !ok || productID == "" {
		return nil, fmt.Errorf("polar product not configured for tier %s", tier)
	}

	req := polarCheckoutCreateRequest{
		Products:           []string{productID},
		CustomerEmail:      user.Email,
		CustomerName:       user.Name,
		ExternalCustomerID: fmt.Sprintf("%d", user.ID),
		SuccessURL:         successURL,
		ReturnURL:          returnURL,
		Metadata: map[string]string{
			"user_id": fmt.Sprintf("%d", user.ID),
			"tier":    string(tier),
		},
	}

	resp, err := s.doRequest(ctx, http.MethodPost, "/v1/checkouts/", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("polar checkout error (%d): %s", resp.StatusCode, string(body))
	}

	var checkout polarCheckoutResponse
	if err := json.NewDecoder(resp.Body).Decode(&checkout); err != nil {
		return nil, fmt.Errorf("decode polar checkout: %w", err)
	}
	if checkout.URL == "" {
		return nil, errors.New("polar checkout missing url")
	}

	return &InitializePaymentResponse{
		AuthorizationURL: checkout.URL,
		Reference:        checkout.ID,
		AccessCode:       checkout.ID,
		Provider:         BillingProviderPolar,
	}, nil
}

// CancelSubscription revokes an active Polar subscription.
func (s *PolarService) CancelSubscription(ctx context.Context, subscriptionID string) error {
	resp, err := s.doRequest(ctx, http.MethodPost, fmt.Sprintf("/v1/subscriptions/%s/revoke", subscriptionID), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("polar revoke error (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// HandleWebhook processes Polar webhook events (Standard Webhooks format).
func (s *PolarService) HandleWebhook(ctx context.Context, body []byte, webhookID, webhookTimestamp, webhookSignature string) error {
	if !s.verifyWebhook(body, webhookID, webhookTimestamp, webhookSignature) {
		return errors.New("invalid polar webhook signature")
	}

	var event polarWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return fmt.Errorf("parse polar webhook: %w", err)
	}

	switch event.Type {
	case "subscription.active", "subscription.created", "subscription.updated":
		return s.handleSubscriptionActive(ctx, event.Data)
	case "subscription.canceled", "subscription.revoked":
		return s.handleSubscriptionCanceled(ctx, event.Data)
	case "order.paid":
		return s.handleOrderPaid(ctx, event.Data)
	default:
		return nil
	}
}

func (s *PolarService) handleSubscriptionActive(ctx context.Context, data json.RawMessage) error {
	var sub polarSubscriptionData
	if err := json.Unmarshal(data, &sub); err != nil {
		return err
	}

	userID, tier, err := s.resolveUserFromMetadata(sub.Metadata)
	if err != nil {
		return err
	}
	if tier == "" {
		tier = s.tierFromProductID(sub.ProductID)
	}

	now := time.Now().UTC()
	var periodEnd *time.Time
	if sub.CurrentPeriodEnd != "" {
		if t, parseErr := time.Parse(time.RFC3339, sub.CurrentPeriodEnd); parseErr == nil {
			periodEnd = &t
		}
	}

	updates := map[string]interface{}{
		"tier":                   tier,
		"status":                 models.StatusActive,
		"billing_provider":       BillingProviderPolar,
		"polar_subscription_id":  sub.ID,
		"polar_customer_id":      sub.CustomerID,
		"currency":               "USD",
		"amount_cents":           sub.Amount,
		"period_start":           &now,
		"period_end":             periodEnd,
		"updated_at":             now,
	}

	return s.db.WithContext(ctx).
		Model(&models.Subscription{}).
		Where("user_id = ?", userID).
		Updates(updates).Error
}

func (s *PolarService) handleSubscriptionCanceled(ctx context.Context, data json.RawMessage) error {
	var sub polarSubscriptionData
	if err := json.Unmarshal(data, &sub); err != nil {
		return err
	}

	now := time.Now().UTC()
	return s.db.WithContext(ctx).
		Model(&models.Subscription{}).
		Where("polar_subscription_id = ?", sub.ID).
		Updates(map[string]interface{}{
			"status":       models.StatusCancelled,
			"cancelled_at": &now,
			"updated_at":   now,
		}).Error
}

func (s *PolarService) handleOrderPaid(ctx context.Context, data json.RawMessage) error {
	var order polarOrderData
	if err := json.Unmarshal(data, &order); err != nil {
		return err
	}

	userID, _, err := s.resolveUserFromMetadata(order.Metadata)
	if err != nil {
		return nil
	}

	lineItems := []models.InvoiceLineItem{{
		Description: "Logstack subscription",
		Amount:      order.Amount,
		Quantity:    1,
	}}
	lineItemsJSON, err := json.Marshal(lineItems)
	if err != nil {
		return err
	}

	now := time.Now().UTC()
	invoice := models.Invoice{
		Reference: order.ID,
		Status:    "pending",
		UserID:    userID,
	}
	if err := s.db.WithContext(ctx).
		Where(models.Invoice{Reference: order.ID}).
		FirstOrCreate(&invoice).Error; err != nil {
		return err
	}

	return s.db.WithContext(ctx).Model(&invoice).Updates(map[string]interface{}{
		"status":       "paid",
		"paid_at":      &now,
		"amount_cents": order.Amount,
		"currency":     order.Currency,
		"line_items":   datatypes.JSON(lineItemsJSON),
		"user_id":      userID,
		"updated_at":   now,
	}).Error
}

func (s *PolarService) resolveUserFromMetadata(metadata map[string]string) (uint, models.SubscriptionTier, error) {
	if metadata == nil {
		return 0, "", errors.New("missing metadata")
	}
	userIDStr, ok := metadata["user_id"]
	if !ok || userIDStr == "" {
		return 0, "", errors.New("missing user_id in metadata")
	}
	var userID uint
	if _, err := fmt.Sscanf(userIDStr, "%d", &userID); err != nil {
		return 0, "", fmt.Errorf("invalid user_id: %w", err)
	}
	tier := models.SubscriptionTier(metadata["tier"])
	return userID, tier, nil
}

func (s *PolarService) tierFromProductID(productID string) models.SubscriptionTier {
	for tier, id := range s.productIDs {
		if id == productID {
			return tier
		}
	}
	return models.TierFree
}

func (s *PolarService) verifyWebhook(payload []byte, webhookID, webhookTimestamp, webhookSignature string) bool {
	if s.webhookSecret == "" {
		return false
	}
	signedContent := fmt.Sprintf("%s.%s", webhookID, webhookTimestamp)
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write([]byte(signedContent))
	mac.Write(payload)
	expected := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	for _, sig := range strings.Split(webhookSignature, " ") {
		parts := strings.SplitN(sig, ",", 2)
		if len(parts) != 2 {
			continue
		}
		if parts[0] == "v1" && hmac.Equal([]byte(parts[1]), []byte(expected)) {
			return true
		}
	}
	return false
}

func (s *PolarService) doRequest(ctx context.Context, method, endpoint string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, polarAPIBaseURL+endpoint, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.accessToken)
	req.Header.Set("Content-Type", "application/json")

	return s.httpClient.Do(req)
}