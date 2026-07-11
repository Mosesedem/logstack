package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	paystackBaseURL = "https://api.paystack.co"
)

// BillingService orchestrates Paystack (Nigeria/NGN) and Polar (international/USD) billing.
type BillingService struct {
	db          *gorm.DB
	secretKey   string
	publicKey   string
	webhookURL  string
	polar       *PolarService
	httpClient  *http.Client
}

// NewBillingService creates a new billing service.
func NewBillingService(db *gorm.DB, secretKey, publicKey, webhookURL string, polar *PolarService) *BillingService {
	return &BillingService{
		db:         db,
		secretKey:  secretKey,
		publicKey:  publicKey,
		webhookURL: webhookURL,
		polar:      polar,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *BillingService) IsPaystackConfigured() bool {
	return s != nil && s.secretKey != ""
}

func (s *BillingService) IsPolarConfigured() bool {
	return s != nil && s.polar != nil && s.polar.IsConfigured()
}

func (s *BillingService) GetBillingContext(user *models.User) BillingContext {
	return ResolveBillingContext(user.Country)
}

// PaystackInitializeRequest represents the request to initialize a transaction
type PaystackInitializeRequest struct {
	Email       string            `json:"email"`
	Amount      int               `json:"amount"` // In smallest currency unit (kobo for NGN, cents for USD)
	Currency    string            `json:"currency"`
	Plan        string            `json:"plan,omitempty"`
	CallbackURL string            `json:"callback_url,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	Channels    []string          `json:"channels,omitempty"`
}

// PaystackInitializeResponse represents the response from initialization
type PaystackInitializeResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		AuthorizationURL string `json:"authorization_url"`
		AccessCode       string `json:"access_code"`
		Reference        string `json:"reference"`
	} `json:"data"`
}

// PaystackPlanRequest represents a plan creation request
type PaystackPlanRequest struct {
	Name        string `json:"name"`
	Amount      int    `json:"amount"`
	Interval    string `json:"interval"` // monthly, yearly
	Currency    string `json:"currency"`
	Description string `json:"description,omitempty"`
}

// PaystackPlanResponse represents a plan response
type PaystackPlanResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		ID           int    `json:"id"`
		Name         string `json:"name"`
		PlanCode     string `json:"plan_code"`
		Amount       int    `json:"amount"`
		Interval     string `json:"interval"`
		Currency     string `json:"currency"`
		SendInvoices bool   `json:"send_invoices"`
	} `json:"data"`
}

// PaystackCustomerRequest represents a customer creation request
type PaystackCustomerRequest struct {
	Email     string            `json:"email"`
	FirstName string            `json:"first_name,omitempty"`
	LastName  string            `json:"last_name,omitempty"`
	Phone     string            `json:"phone,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// PaystackCustomerResponse represents a customer response
type PaystackCustomerResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		ID           int    `json:"id"`
		CustomerCode string `json:"customer_code"`
		Email        string `json:"email"`
		FirstName    string `json:"first_name"`
		LastName     string `json:"last_name"`
	} `json:"data"`
}

// PaystackSubscriptionResponse represents a subscription response
type PaystackSubscriptionResponse struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    struct {
		ID               int    `json:"id"`
		SubscriptionCode string `json:"subscription_code"`
		Status           string `json:"status"`
		NextPaymentDate  string `json:"next_payment_date"`
	} `json:"data"`
}

// PaystackWebhookEvent represents a webhook event from Paystack
type PaystackWebhookEvent struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

// PaystackSubscriptionData represents subscription data from webhooks
type PaystackSubscriptionData struct {
	SubscriptionCode string `json:"subscription_code"`
	CustomerCode     string `json:"customer_code"`
	PlanCode         string `json:"plan_code,omitempty"`
	Plan             struct {
		PlanCode string `json:"plan_code"`
		Name     string `json:"name"`
		Amount   int    `json:"amount"`
		Currency string `json:"currency"`
		Interval string `json:"interval"`
	} `json:"plan"`
	Status          string `json:"status"`
	Amount          int    `json:"amount"`
	NextPaymentDate string `json:"next_payment_date"`
}

// PaystackInvoiceData represents invoice data from webhooks
type PaystackInvoiceData struct {
	SubscriptionCode string `json:"subscription_code"`
	CustomerCode     string `json:"customer_code"`
	Status           string `json:"status"` // success, failed
	Amount           int    `json:"amount"`
	PaidAt           string `json:"paid_at"`
}

// PaystackTransactionData represents transaction history
type PaystackTransactionData struct {
	ID        int    `json:"id"`
	Reference string `json:"reference"`
	Amount    int    `json:"amount"`
	Currency  string `json:"currency"`
	Status    string `json:"status"`
	PaidAt    string `json:"paid_at"`
	Channel   string `json:"channel"`
}

// PaystackChargeData represents charge data from the charge.success webhook event
type PaystackChargeData struct {
	Reference  string `json:"reference"`
	Amount     int    `json:"amount"`
	Currency   string `json:"currency"`
	Status     string `json:"status"`
	PaidAt     string `json:"paid_at"`
	Channel    string `json:"channel"`
	Customer   struct {
		Email string `json:"email"`
	} `json:"customer"`
	// Metadata may contain a "description" key from the initiating request
	Metadata map[string]string `json:"metadata"`
	// PlanObject is populated on subscription charges
	PlanObject struct {
		Name     string `json:"name"`
		Amount   int    `json:"amount"`
		Currency string `json:"currency"`
	} `json:"plan_object"`
}

// PaystackTransactionListResponse represents a list of transactions
type PaystackTransactionListResponse struct {
	Status  bool                      `json:"status"`
	Message string                    `json:"message"`
	Data    []PaystackTransactionData `json:"data"`
	Meta    struct {
		Total     int `json:"total"`
		Page      int `json:"page"`
		PerPage   int `json:"perPage"`
		PageCount int `json:"pageCount"`
	} `json:"meta"`
}

// InitializePaymentRequest is the API request for initializing payment
type InitializePaymentRequest struct {
	Tier        models.SubscriptionTier `json:"tier" binding:"required"`
	Currency    string                  `json:"currency" binding:"required"`
	CallbackURL string                  `json:"callbackUrl,omitempty"`
}

// InitializePaymentResponse is the API response for payment initialization
type InitializePaymentResponse struct {
	AuthorizationURL string `json:"authorizationUrl"`
	Reference        string `json:"reference"`
	AccessCode       string `json:"accessCode"`
	Provider         string `json:"provider"`
}

// InitializePayment creates a checkout session routed by user country/currency.
func (s *BillingService) InitializePayment(ctx context.Context, userID uint, req InitializePaymentRequest) (*InitializePaymentResponse, error) {
	var user models.User
	if err := s.db.WithContext(ctx).First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	billingCtx := ResolveBillingContext(user.Country)
	if billingCtx.CountryRequired {
		return nil, errors.New("set your country in Billing or Settings before checkout so we can charge in the correct currency")
	}
	// Normalize currency; if client omits or mismatches, prefer region currency.
	req.Currency = strings.ToUpper(strings.TrimSpace(req.Currency))
	if req.Currency == "" {
		req.Currency = billingCtx.Currency
	}
	if req.Currency != billingCtx.Currency {
		return nil, fmt.Errorf(
			"currency %s is not available for country %s; use %s (%s)",
			req.Currency,
			billingCtx.Country,
			billingCtx.Currency,
			billingCtx.PaymentLabel,
		)
	}

	tiers := models.LoadPricingTiers(s.db)
	var amount int
	var found bool
	for _, tier := range tiers {
		if tier.Tier == req.Tier {
			if price, ok := tier.Prices[req.Currency]; ok {
				amount = price
				found = true
				break
			}
		}
	}
	if !found {
		return nil, errors.New("invalid tier or currency")
	}
	if amount <= 0 {
		return nil, errors.New("cannot initialize payment for free tier or enterprise (contact sales)")
	}

	// Ensure local subscription row exists before provider redirects.
	if _, err := s.GetSubscription(ctx, userID); err != nil {
		return nil, fmt.Errorf("subscription: %w", err)
	}

	if billingCtx.Provider == BillingProviderPolar {
		if !s.IsPolarConfigured() {
			return nil, errors.New("international billing is not configured")
		}
		// Polar requires absolute https URLs (relative paths like "/billing" → 422).
		successURL := strings.TrimSpace(req.CallbackURL)
		if successURL == "" {
			successURL = "https://www.logstack.tech/billing?success=true"
		}
		successURL, returnURL, err := absolutePolarCheckoutURLs(successURL)
		if err != nil {
			return nil, err
		}
		resp, err := s.polar.InitializeCheckout(ctx, &user, req.Tier, successURL, returnURL)
		if err != nil {
			return nil, err
		}
		return resp, nil
	}

	return s.initializePaystackSubscription(ctx, &user, req, amount)
}

// absolutePolarCheckoutURLs ensures Polar success_url / return_url are absolute.
// Polar rejects relative paths ("relative URL without a base").
func absolutePolarCheckoutURLs(successURL string) (success string, returnURL string, err error) {
	u, parseErr := url.Parse(strings.TrimSpace(successURL))
	if parseErr != nil || u.Scheme == "" || u.Host == "" {
		return "", "", fmt.Errorf("callbackUrl must be an absolute URL (got %q)", successURL)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", "", fmt.Errorf("callbackUrl must use http or https (got %q)", successURL)
	}

	success = u.String()

	// Back button on Polar checkout → billing page on the same origin.
	ret := *u
	ret.Path = "/billing"
	ret.RawQuery = ""
	ret.Fragment = ""
	return success, ret.String(), nil
}

// initializePaystackSubscription sets up a Paystack plan + first authorization charge.
// Amount is the plan price in kobo/cents (Paystack requires a positive amount with plan).
func (s *BillingService) initializePaystackSubscription(ctx context.Context, user *models.User, req InitializePaymentRequest, amount int) (*InitializePaymentResponse, error) {
	if !s.IsPaystackConfigured() {
		return nil, errors.New("paystack billing is not configured")
	}
	if amount <= 0 {
		return nil, errors.New("invalid paystack amount")
	}

	customerCode, err := s.getOrCreatePaystackCustomer(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("paystack customer: %w", err)
	}

	planCode, err := s.getOrCreatePlan(ctx, req.Tier, req.Currency, amount)
	if err != nil {
		return nil, fmt.Errorf("paystack plan: %w", err)
	}

	// Persist customer + pending plan so webhooks can resolve the user.
	if err := s.db.WithContext(ctx).
		Model(&models.Subscription{}).
		Where("user_id = ?", user.ID).
		Updates(map[string]interface{}{
			"paystack_customer_code": customerCode,
			"paystack_plan_code":     planCode,
			"billing_provider":       BillingProviderPaystack,
			"currency":               req.Currency,
			"amount_cents":           amount,
			"updated_at":             time.Now().UTC(),
		}).Error; err != nil {
		return nil, fmt.Errorf("update subscription for paystack: %w", err)
	}

	callback := strings.TrimSpace(req.CallbackURL)
	if callback == "" {
		callback = "https://www.logstack.tech/billing?success=true"
	}

	paystackReq := PaystackInitializeRequest{
		Email:       user.Email,
		Amount:      amount, // kobo/cents — must match plan for subscription checkout
		Currency:    req.Currency,
		Plan:        planCode,
		CallbackURL: callback,
		Metadata: map[string]string{
			"user_id":         fmt.Sprintf("%d", user.ID),
			"tier":            string(req.Tier),
			"plan_code":       planCode,
			"customer_code":   customerCode,
			"is_subscription": "true",
			"currency":        req.Currency,
		},
		Channels: []string{"card", "bank", "ussd", "bank_transfer"},
	}

	resp, err := s.doRequest(ctx, "POST", "/transaction/initialize", paystackReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var initResp PaystackInitializeResponse
	if err := json.Unmarshal(body, &initResp); err != nil {
		return nil, fmt.Errorf("paystack initialize decode: %w (body=%s)", err, truncatePaystackBody(body))
	}

	if resp.StatusCode >= 300 || !initResp.Status {
		msg := initResp.Message
		if msg == "" {
			msg = truncatePaystackBody(body)
		}
		return nil, fmt.Errorf("paystack error: %s", msg)
	}
	if initResp.Data.AuthorizationURL == "" {
		return nil, errors.New("paystack error: missing authorization_url")
	}

	return &InitializePaymentResponse{
		AuthorizationURL: initResp.Data.AuthorizationURL,
		Reference:        initResp.Data.Reference,
		AccessCode:       initResp.Data.AccessCode,
		Provider:         BillingProviderPaystack,
	}, nil
}

func truncatePaystackBody(b []byte) string {
	const max = 400
	s := strings.TrimSpace(string(b))
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

// getOrCreatePaystackCustomer fetches an existing customer by email or creates one.
func (s *BillingService) getOrCreatePaystackCustomer(ctx context.Context, user *models.User) (string, error) {
	var subscription models.Subscription
	if err := s.db.WithContext(ctx).Where("user_id = ?", user.ID).First(&subscription).Error; err == nil {
		if subscription.PaystackCustomerCode != nil && *subscription.PaystackCustomerCode != "" {
			return *subscription.PaystackCustomerCode, nil
		}
	}

	// Paystack fetch-by-email requires a path-encoded address.
	fetchPath := "/customer/" + url.PathEscape(user.Email)
	fetchResp, fetchErr := s.doRequest(ctx, "GET", fetchPath, nil)
	if fetchErr == nil {
		defer fetchResp.Body.Close()
		body, _ := io.ReadAll(fetchResp.Body)
		var existing struct {
			Status bool `json:"status"`
			Data   struct {
				CustomerCode string `json:"customer_code"`
			} `json:"data"`
		}
		if json.Unmarshal(body, &existing) == nil && existing.Status && existing.Data.CustomerCode != "" {
			return existing.Data.CustomerCode, nil
		}
	}

	customerReq := PaystackCustomerRequest{
		Email:     user.Email,
		FirstName: user.Name,
		Metadata: map[string]string{
			"user_id": fmt.Sprintf("%d", user.ID),
		},
	}
	resp, err := s.doRequest(ctx, "POST", "/customer", customerReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var customerResp PaystackCustomerResponse
	if err := json.Unmarshal(body, &customerResp); err != nil {
		return "", fmt.Errorf("create customer decode: %w", err)
	}
	if !customerResp.Status || customerResp.Data.CustomerCode == "" {
		msg := customerResp.Message
		if msg == "" {
			msg = truncatePaystackBody(body)
		}
		return "", fmt.Errorf("failed to create customer: %s", msg)
	}
	return customerResp.Data.CustomerCode, nil
}

// getOrCreatePlan gets an existing plan or creates a new one
func (s *BillingService) getOrCreatePlan(ctx context.Context, tier models.SubscriptionTier, currency string, amount int) (string, error) {
	// Plan naming convention: logstack_<tier>_<currency>_monthly
	planName := fmt.Sprintf("logstack_%s_%s_monthly", tier, currency)

	// Check if plan exists (we could cache this)
	listResp, err := s.doRequest(ctx, "GET", "/plan?perPage=100", nil)
	if err != nil {
		return "", err
	}
	defer listResp.Body.Close()

	var plansResp struct {
		Status bool `json:"status"`
		Data   []struct {
			PlanCode string `json:"plan_code"`
			Name     string `json:"name"`
			Currency string `json:"currency"`
		} `json:"data"`
	}

	if err := json.NewDecoder(listResp.Body).Decode(&plansResp); err != nil {
		return "", err
	}

	for _, plan := range plansResp.Data {
		if plan.Name == planName && plan.Currency == currency {
			return plan.PlanCode, nil
		}
	}

	// Create new plan
	planReq := PaystackPlanRequest{
		Name:        planName,
		Amount:      amount,
		Interval:    "monthly",
		Currency:    currency,
		Description: fmt.Sprintf("LogStack %s Plan - %s", tier, currency),
	}

	resp, err := s.doRequest(ctx, "POST", "/plan", planReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var planResp PaystackPlanResponse
	if err := json.NewDecoder(resp.Body).Decode(&planResp); err != nil {
		return "", err
	}

	if !planResp.Status {
		return "", fmt.Errorf("failed to create plan: %s", planResp.Message)
	}

	return planResp.Data.PlanCode, nil
}

// HandleWebhook processes Paystack webhook events
func (s *BillingService) HandleWebhook(ctx context.Context, body []byte, signature string) error {
	// Verify signature
	if !s.verifySignature(body, signature) {
		return errors.New("invalid webhook signature")
	}

	var event PaystackWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return fmt.Errorf("failed to parse webhook: %w", err)
	}

	switch event.Event {
	case "subscription.create":
		return s.handleSubscriptionCreate(ctx, event.Data)
	case "subscription.disable":
		return s.handleSubscriptionDisable(ctx, event.Data)
	case "invoice.update":
		return s.handleInvoiceUpdate(ctx, event.Data)
	case "charge.success":
		return s.handleChargeSuccess(ctx, event.Data)
	default:
		// Ignore unhandled events
		return nil
	}
}

// handleSubscriptionCreate activates a subscription
func (s *BillingService) handleSubscriptionCreate(ctx context.Context, data json.RawMessage) error {
	var subData PaystackSubscriptionData
	if err := json.Unmarshal(data, &subData); err != nil {
		return err
	}

	// Find user by customer code
	var subscription models.Subscription
	if err := s.db.WithContext(ctx).
		Where("paystack_customer_code = ?", subData.CustomerCode).
		First(&subscription).Error; err != nil {
		return fmt.Errorf("subscription not found for customer: %s", subData.CustomerCode)
	}

	// Determine tier from plan code
	tier := s.getTierFromPlanCode(subData.Plan.PlanCode)

	// Parse next payment date
	var periodEnd *time.Time
	if subData.NextPaymentDate != "" {
		if t, err := time.Parse(time.RFC3339, subData.NextPaymentDate); err == nil {
			periodEnd = &t
		}
	}

	now := time.Now().UTC()

	// Update subscription
	updates := map[string]interface{}{
		"tier":                        tier,
		"status":                      models.StatusActive,
		"billing_provider":            BillingProviderPaystack,
		"paystack_subscription_code":  subData.SubscriptionCode,
		"paystack_plan_code":          subData.Plan.PlanCode,
		"currency":                    subData.Plan.Currency,
		"amount_cents":                subData.Plan.Amount,
		"period_start":                &now,
		"period_end":                  periodEnd,
		"updated_at":                  now,
	}

	return s.db.WithContext(ctx).Model(&subscription).Updates(updates).Error
}

// handleSubscriptionDisable handles subscription cancellation
func (s *BillingService) handleSubscriptionDisable(ctx context.Context, data json.RawMessage) error {
	var subData PaystackSubscriptionData
	if err := json.Unmarshal(data, &subData); err != nil {
		return err
	}

	now := time.Now().UTC()

	// Find and update subscription
	return s.db.WithContext(ctx).
		Model(&models.Subscription{}).
		Where("paystack_subscription_code = ?", subData.SubscriptionCode).
		Updates(map[string]interface{}{
			"status":       models.StatusCancelled,
			"cancelled_at": &now,
			"updated_at":   now,
		}).Error
}

// handleInvoiceUpdate handles invoice payment status
func (s *BillingService) handleInvoiceUpdate(ctx context.Context, data json.RawMessage) error {
	var invoiceData PaystackInvoiceData
	if err := json.Unmarshal(data, &invoiceData); err != nil {
		return err
	}

	// Find subscription
	var subscription models.Subscription
	if err := s.db.WithContext(ctx).
		Where("paystack_subscription_code = ?", invoiceData.SubscriptionCode).
		First(&subscription).Error; err != nil {
		return nil // Subscription not found, ignore
	}

	now := time.Now().UTC()

	switch invoiceData.Status {
	case "success":
		// Payment successful - extend period
		periodEnd := now.AddDate(0, 1, 0) // Add 1 month
		return s.db.WithContext(ctx).Model(&subscription).Updates(map[string]interface{}{
			"status":       models.StatusActive,
			"period_end":   &periodEnd,
			"updated_at":   now,
		}).Error

	case "failed":
		// Payment failed - mark as past due
		return s.db.WithContext(ctx).Model(&subscription).Updates(map[string]interface{}{
			"status":     models.StatusPastDue,
			"updated_at": now,
		}).Error
	}

	return nil
}

// handleChargeSuccess handles successful one-time charges by upserting an Invoice record.
func (s *BillingService) handleChargeSuccess(ctx context.Context, data json.RawMessage) error {
	var chargeData PaystackChargeData
	if err := json.Unmarshal(data, &chargeData); err != nil {
		return fmt.Errorf("failed to parse charge data: %w", err)
	}

	if chargeData.Reference == "" {
		return errors.New("charge.success event missing reference")
	}

	// Resolve user ID from the customer email; skip association if not found.
	var userID uint
	if chargeData.Customer.Email != "" {
		var user models.User
		if err := s.db.WithContext(ctx).
			Where("email = ?", chargeData.Customer.Email).
			First(&user).Error; err == nil {
			userID = user.ID
		}
		// If not found we leave userID = 0 (association skipped)
	}

	// Determine line-item description: prefer plan name, then metadata description.
	description := chargeData.PlanObject.Name
	if description == "" {
		if d, ok := chargeData.Metadata["description"]; ok && d != "" {
			description = d
		}
	}
	if description == "" {
		description = "Logstack subscription"
	}

	// Marshal line items into datatypes.JSON.
	lineItems := []models.InvoiceLineItem{
		{
			Description: description,
			Amount:      chargeData.Amount,
			Quantity:    1,
		},
	}
	lineItemsJSON, err := json.Marshal(lineItems)
	if err != nil {
		return fmt.Errorf("failed to marshal line items: %w", err)
	}

	now := time.Now().UTC()

	// Upsert: find or create by reference with status="pending".
	invoice := models.Invoice{
		Reference: chargeData.Reference,
		Status:    "pending",
		UserID:    userID,
	}
	result := s.db.WithContext(ctx).
		Where(models.Invoice{Reference: chargeData.Reference}).
		FirstOrCreate(&invoice)
	if result.Error != nil {
		return fmt.Errorf("failed to upsert invoice: %w", result.Error)
	}

	// Now update to paid status with full details.
	updates := map[string]interface{}{
		"status":       "paid",
		"paid_at":      &now,
		"amount_cents": chargeData.Amount,
		"currency":     chargeData.Currency,
		"line_items":   datatypes.JSON(lineItemsJSON),
		"updated_at":   now,
	}
	if userID != 0 {
		updates["user_id"] = userID
	}

	return s.db.WithContext(ctx).
		Model(&invoice).
		Updates(updates).Error
}

// getTierFromPlanCode extracts the tier from a plan code
func (s *BillingService) getTierFromPlanCode(planCode string) models.SubscriptionTier {
	// Plan codes are like: PLN_xxxxx, but we named them logstack_<tier>_<currency>_monthly
	// We need to fetch the plan to get the name, or use metadata
	// For simplicity, we'll check known patterns
	switch {
	case contains(planCode, "starter"):
		return models.TierStarter
	case contains(planCode, "pro"):
		return models.TierPro
	case contains(planCode, "enterprise"):
		return models.TierEnterprise
	default:
		return models.TierFree
	}
}

// contains checks if a string contains a substring (case insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsLower(s, substr))
}

func containsLower(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if equalFold(s[i:i+len(substr)], substr) {
			return true
		}
	}
	return false
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}

// verifySignature verifies the Paystack webhook signature
func (s *BillingService) verifySignature(body []byte, signature string) bool {
	mac := hmac.New(sha512.New, []byte(s.secretKey))
	mac.Write(body)
	expectedSig := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expectedSig), []byte(signature))
}

// GetSubscription retrieves the subscription for a user
func (s *BillingService) GetSubscription(ctx context.Context, userID uint) (*models.Subscription, error) {
	var subscription models.Subscription
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&subscription).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create default free subscription
			subscription = models.Subscription{
				UserID:   userID,
				Tier:     models.TierFree,
				Status:   models.StatusActive,
				Currency: "USD",
			}
			if err := s.db.WithContext(ctx).Create(&subscription).Error; err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	return &subscription, nil
}

// GetTransactionHistory fetches transaction history from Paystack
func (s *BillingService) GetTransactionHistory(ctx context.Context, customerCode string, page, perPage int) (*PaystackTransactionListResponse, error) {
	endpoint := fmt.Sprintf("/transaction?customer=%s&page=%d&perPage=%d", customerCode, page, perPage)
	
	resp, err := s.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var txResp PaystackTransactionListResponse
	if err := json.NewDecoder(resp.Body).Decode(&txResp); err != nil {
		return nil, err
	}

	return &txResp, nil
}

// CancelSubscription cancels a user's subscription with the active provider.
func (s *BillingService) CancelSubscription(ctx context.Context, userID uint) error {
	var subscription models.Subscription
	if err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&subscription).Error; err != nil {
		return err
	}

	if subscription.BillingProvider == BillingProviderPolar {
		if !s.IsPolarConfigured() {
			return errors.New("polar billing is not configured")
		}
		if subscription.PolarSubscriptionID == nil || *subscription.PolarSubscriptionID == "" {
			return errors.New("no active polar subscription to cancel")
		}
		if err := s.polar.CancelSubscription(ctx, *subscription.PolarSubscriptionID); err != nil {
			return err
		}
		now := time.Now().UTC()
		return s.db.WithContext(ctx).Model(&subscription).Updates(map[string]interface{}{
			"status":       models.StatusCancelled,
			"cancelled_at": &now,
			"updated_at":   now,
		}).Error
	}

	if subscription.PaystackSubscriptionCode == nil {
		return errors.New("no active subscription to cancel")
	}

	// First, get the subscription from Paystack to get the disable token
	endpoint := fmt.Sprintf("/subscription/%s", *subscription.PaystackSubscriptionCode)
	resp, err := s.doRequest(ctx, "GET", endpoint, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var paystackSubResp struct {
		Status bool `json:"status"`
		Data   struct {
			SubscriptionCode string `json:"subscription_code"`
			DisableCode      string `json:"disable_code"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&paystackSubResp); err != nil {
		return err
	}

	if !paystackSubResp.Status {
		return errors.New("failed to fetch subscription details from Paystack")
	}

	// Disable subscription on Paystack using the disable token
	disableEndpoint := "/subscription/disable"
	body := map[string]string{
		"code":      paystackSubResp.Data.SubscriptionCode,
		"disable_code": paystackSubResp.Data.DisableCode,
	}

	resp2, err := s.doRequest(ctx, "POST", disableEndpoint, body)
	if err != nil {
		return err
	}
	resp2.Body.Close()

	// Update local subscription
	now := time.Now().UTC()
	return s.db.WithContext(ctx).Model(&subscription).Updates(map[string]interface{}{
		"status":       models.StatusCancelled,
		"cancelled_at": &now,
		"updated_at":   now,
	}).Error
}

// CreateOrUpdateCustomer creates or updates a Paystack customer
func (s *BillingService) CreateOrUpdateCustomer(ctx context.Context, user *models.User) (string, error) {
	// Check if user already has a customer code
	var subscription models.Subscription
	if err := s.db.WithContext(ctx).Where("user_id = ?", user.ID).First(&subscription).Error; err == nil {
		if subscription.PaystackCustomerCode != nil {
			return *subscription.PaystackCustomerCode, nil
		}
	}

	// Create customer on Paystack
	customerReq := PaystackCustomerRequest{
		Email:     user.Email,
		FirstName: user.Name,
		Metadata: map[string]string{
			"user_id": fmt.Sprintf("%d", user.ID),
		},
	}

	resp, err := s.doRequest(ctx, "POST", "/customer", customerReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var customerResp PaystackCustomerResponse
	if err := json.NewDecoder(resp.Body).Decode(&customerResp); err != nil {
		return "", err
	}

	if !customerResp.Status {
		return "", fmt.Errorf("failed to create customer: %s", customerResp.Message)
	}

	// Update subscription with customer code
	s.db.WithContext(ctx).Model(&subscription).Update("paystack_customer_code", customerResp.Data.CustomerCode)

	return customerResp.Data.CustomerCode, nil
}

// doRequest makes an authenticated request to the Paystack API
func (s *BillingService) doRequest(ctx context.Context, method, endpoint string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, paystackBaseURL+endpoint, reqBody)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.secretKey)
	req.Header.Set("Content-Type", "application/json")

	return s.httpClient.Do(req)
}

// HandlePolarWebhook delegates to the Polar service.
func (s *BillingService) HandlePolarWebhook(ctx context.Context, body []byte, webhookID, webhookTimestamp, webhookSignature string) error {
	if !s.IsPolarConfigured() {
		return errors.New("polar billing is not configured")
	}
	return s.polar.HandleWebhook(ctx, body, webhookID, webhookTimestamp, webhookSignature)
}

// GetPricingTiers returns all available pricing tiers (DB-backed when seeded).
func (s *BillingService) GetPricingTiers() []models.PricingTier {
	return models.LoadPricingTiers(s.db)
}
