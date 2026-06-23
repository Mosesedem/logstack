package handlers

import (
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services"
	"github.com/mosesedem/logstack/internal/workers"
	"gorm.io/gorm"
)

// BillingHandler handles billing-related requests
type BillingHandler struct {
	billingService  *services.BillingService
	usageSyncWorker *workers.UsageSyncWorker
	db              *gorm.DB
}

// NewBillingHandler creates a new billing handler
func NewBillingHandler(billingService *services.BillingService, usageSyncWorker *workers.UsageSyncWorker, db *gorm.DB) *BillingHandler {
	return &BillingHandler{
		billingService:  billingService,
		usageSyncWorker: usageSyncWorker,
		db:              db,
	}
}

// GetPricing returns the pricing tiers
// GET /v1/billing/pricing
func (h *BillingHandler) GetPricing(c *gin.Context) {
	// Return static pricing even if billing service is not configured
	tiers := models.GetPricingTiers()
	c.JSON(http.StatusOK, gin.H{
		"tiers": tiers,
		"currencies": []gin.H{
			{"code": "USD", "symbol": "$", "name": "US Dollar"},
			{"code": "NGN", "symbol": "₦", "name": "Nigerian Naira"},
			{"code": "GHS", "symbol": "GH₵", "name": "Ghanaian Cedi"},
		},
	})
}

// GetSubscription returns the current user's subscription
// GET /v1/billing/subscription
func (h *BillingHandler) GetSubscription(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}
// Check if billing service is configured
	if h.billingService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Billing service is not configured",
		})
		return
	}

	
	subscription, err := h.billingService.GetSubscription(c.Request.Context(), userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get subscription"})
		return
	}

	c.JSON(http.StatusOK, subscription.ToResponse())
}

// GetUsage returns the current user's usage
// GET /v1/billing/usage
func (h *BillingHandler) GetUsage(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	usage, err := h.usageSyncWorker.GetUserUsageSummary(c.Request.Context(), userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get usage"})
		return
	}

	c.JSON(http.StatusOK, usage)
}

// InitializePaymentRequest is the request body for initializing payment
type InitializePaymentRequest struct {
	Tier        string `json:"tier" binding:"required"`
	Currency    string `json:"currency" binding:"required"`
	CallbackURL string `json:"callbackUrl,omitempty"`
}

// InitializePayment initializes a payment session
// POST /v1/billing/initialize
func (h *BillingHandler) InitializePayment(c *gin.Context) {
	// Check if billing service is configured
	if h.billingService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Billing service is not configured. Please contact support or configure Paystack API keys.",
		})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	var req InitializePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Validate tier
	tier := models.SubscriptionTier(req.Tier)
	if !tier.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tier"})
		return
	}

	// Validate currency
	validCurrencies := map[string]bool{"USD": true, "NGN": true, "GHS": true}
	if !validCurrencies[req.Currency] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid currency"})
		return
	}

	paymentReq := services.InitializePaymentRequest{
		Tier:        tier,
		Currency:    req.Currency,
		CallbackURL: req.CallbackURL,
	}

	resp, err := h.billingService.InitializePayment(c.Request.Context(), userID.(uint), paymentReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetTransactions returns the user's transaction history
// GET /v1/billing/transactions
func (h *BillingHandler) GetTransactions(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	// Check if billing service is configured
	if h.billingService == nil {
		c.JSON(http.StatusOK, gin.H{
			"transactions": []interface{}{},
			"meta": gin.H{
				"total": 0,
				"page":  1,
			},
		})
		return
	}

	// Get subscription to get customer code
	subscription, err := h.billingService.GetSubscription(c.Request.Context(), userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get subscription"})
		return
	}

	if subscription.PaystackCustomerCode == nil {
		// No transactions yet
		c.JSON(http.StatusOK, gin.H{
			"transactions": []interface{}{},
			"meta": gin.H{
				"total": 0,
				"page":  1,
			},
		})
		return
	}

	txResp, err := h.billingService.GetTransactionHistory(c.Request.Context(), *subscription.PaystackCustomerCode, 1, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get transactions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"transactions": txResp.Data,
		"meta":         txResp.Meta,
	})
}

// CancelSubscription cancels the user's subscription
// POST /v1/billing/cancel
func (h *BillingHandler) CancelSubscription(c *gin.Context) {
	// Check if billing service is configured
	if h.billingService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Billing service is not configured",
		})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	if err := h.billingService.CancelSubscription(c.Request.Context(), userID.(uint)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "subscription cancelled successfully"})
}

// GetInvoices returns a paginated list of invoices for the authenticated user
// GET /v1/billing/invoices?page=1
func (h *BillingHandler) GetInvoices(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	const limit = 20

	var invoices []models.Invoice
	var total int64

	if err := h.db.Model(&models.Invoice{}).
		Where("user_id = ?", userID).
		Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count invoices"})
		return
	}

	if err := h.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&invoices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get invoices"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"invoices": invoices,
		"total":    total,
		"page":     page,
	})
}

// GetInvoice returns a single invoice by ID with ownership check
// GET /v1/billing/invoices/:id
func (h *BillingHandler) GetInvoice(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	id := c.Param("id")

	var invoice models.Invoice
	if err := h.db.Where("id = ?", id).First(&invoice).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invoice not found"})
		return
	}

	if invoice.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

// HandleWebhook handles Paystack webhook events
// POST /v1/webhooks/paystack
func (h *BillingHandler) HandleWebhook(c *gin.Context) {
	// Read body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	// Get signature from header
	signature := c.GetHeader("X-Paystack-Signature")
	if signature == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing signature"})
		return
	}

	// Process webhook
	if err := h.billingService.HandleWebhook(c.Request.Context(), body, signature); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}
