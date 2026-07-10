package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/datatypes"
)

// ---------- Pricing plans ----------

type adminPlanBody struct {
	Tier        string            `json:"tier" binding:"required,oneof=free starter pro enterprise"`
	Name        string            `json:"name" binding:"required,min=1,max=100"`
	Description string            `json:"description"`
	LogLimit    int64             `json:"logLimit"`
	Features    []string          `json:"features"`
	Prices      map[string]int    `json:"prices"`
	Limits      map[string]string `json:"limits"`
	SortOrder   *int              `json:"sortOrder"`
	Active      *bool             `json:"active"`
}

type adminPlanUpdateBody struct {
	Name        *string            `json:"name" binding:"omitempty,min=1,max=100"`
	Description *string            `json:"description"`
	LogLimit    *int64             `json:"logLimit"`
	Features    []string           `json:"features"`
	Prices      map[string]int     `json:"prices"`
	Limits      map[string]string  `json:"limits"`
	SortOrder   *int               `json:"sortOrder"`
	Active      *bool              `json:"active"`
	Tier        *string            `json:"tier" binding:"omitempty,oneof=free starter pro enterprise"`
}

func (h *AdminHandler) ListPricingPlans(c *gin.Context) {
	includeInactive := c.Query("includeInactive") == "true"
	query := h.db.Model(&models.PricingPlan{})
	if !includeInactive {
		query = query.Where("active = ?", true)
	}
	var plans []models.PricingPlan
	if err := query.Order("sort_order ASC, id ASC").Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch pricing plans"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"plans": plans, "total": len(plans)})
}

func (h *AdminHandler) GetPricingPlan(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid plan id"})
		return
	}
	var plan models.PricingPlan
	if err := h.db.First(&plan, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Pricing plan not found"})
		return
	}
	c.JSON(http.StatusOK, plan)
}

func (h *AdminHandler) CreatePricingPlan(c *gin.Context) {
	var req adminPlanBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	var existing models.PricingPlan
	if err := h.db.Where("tier = ?", req.Tier).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, ErrorResponse{Code: "TIER_EXISTS", Message: "A plan with this tier already exists"})
		return
	}
	plan, err := buildPlanFromBody(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if err := h.db.Create(&plan).Error; err != nil {
		slog.Error("Admin create pricing plan failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create plan"})
		return
	}
	c.JSON(http.StatusCreated, plan)
}

func (h *AdminHandler) UpdatePricingPlan(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid plan id"})
		return
	}
	var plan models.PricingPlan
	if err := h.db.First(&plan, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Pricing plan not found"})
		return
	}
	var req adminPlanUpdateBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if req.Tier != nil && *req.Tier != plan.Tier {
		var clash models.PricingPlan
		if err := h.db.Where("tier = ? AND id <> ?", *req.Tier, id).First(&clash).Error; err == nil {
			c.JSON(http.StatusConflict, ErrorResponse{Code: "TIER_EXISTS", Message: "A plan with this tier already exists"})
			return
		}
		plan.Tier = *req.Tier
	}
	if req.Name != nil {
		plan.Name = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		plan.Description = *req.Description
	}
	if req.LogLimit != nil {
		plan.LogLimit = *req.LogLimit
	}
	if req.Features != nil {
		b, _ := json.Marshal(req.Features)
		plan.Features = datatypes.JSON(b)
	}
	if req.Prices != nil {
		b, _ := json.Marshal(req.Prices)
		plan.Prices = datatypes.JSON(b)
	}
	if req.Limits != nil {
		b, _ := json.Marshal(req.Limits)
		plan.Limits = datatypes.JSON(b)
	}
	if req.SortOrder != nil {
		plan.SortOrder = *req.SortOrder
	}
	if req.Active != nil {
		plan.Active = *req.Active
	}
	if err := h.db.Save(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update plan"})
		return
	}
	c.JSON(http.StatusOK, plan)
}

func (h *AdminHandler) DeletePricingPlan(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid plan id"})
		return
	}
	result := h.db.Delete(&models.PricingPlan{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete plan"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Pricing plan not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Plan deleted successfully"})
}

func buildPlanFromBody(req adminPlanBody) (models.PricingPlan, error) {
	features := req.Features
	if features == nil {
		features = []string{}
	}
	prices := req.Prices
	if prices == nil {
		prices = map[string]int{}
	}
	limits := req.Limits
	if limits == nil {
		limits = map[string]string{}
	}
	fb, err := json.Marshal(features)
	if err != nil {
		return models.PricingPlan{}, err
	}
	pb, err := json.Marshal(prices)
	if err != nil {
		return models.PricingPlan{}, err
	}
	lb, err := json.Marshal(limits)
	if err != nil {
		return models.PricingPlan{}, err
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	return models.PricingPlan{
		Tier:        req.Tier,
		Name:        strings.TrimSpace(req.Name),
		Description: req.Description,
		LogLimit:    req.LogLimit,
		Features:    datatypes.JSON(fb),
		Prices:      datatypes.JSON(pb),
		Limits:      datatypes.JSON(lb),
		SortOrder:   sortOrder,
		Active:      active,
	}, nil
}

// ---------- Subscriptions ----------

type adminCreateSubscriptionRequest struct {
	UserID          uint   `json:"userId" binding:"required"`
	Tier            string `json:"tier" binding:"required,oneof=free starter pro enterprise"`
	Status          string `json:"status" binding:"omitempty,oneof=active cancelled past_due trialing paused"`
	Currency        string `json:"currency" binding:"omitempty,len=3"`
	AmountCents     *int   `json:"amountCents"`
	BillingProvider string `json:"billingProvider" binding:"omitempty,oneof=none paystack polar"`
	PeriodStart     string `json:"periodStart"` // RFC3339 optional
	PeriodEnd       string `json:"periodEnd"`
}

type adminUpdateSubscriptionRequest struct {
	Tier            *string `json:"tier" binding:"omitempty,oneof=free starter pro enterprise"`
	Status          *string `json:"status" binding:"omitempty,oneof=active cancelled past_due trialing paused"`
	Currency        *string `json:"currency" binding:"omitempty,len=3"`
	AmountCents     *int    `json:"amountCents"`
	BillingProvider *string `json:"billingProvider" binding:"omitempty,oneof=none paystack polar"`
	PeriodStart     *string `json:"periodStart"`
	PeriodEnd       *string `json:"periodEnd"`
	CancelledAt     *string `json:"cancelledAt"`
	UserID          *uint   `json:"userId"`
}

func (h *AdminHandler) ListSubscriptions(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	tier := strings.TrimSpace(c.Query("tier"))
	status := strings.TrimSpace(c.Query("status"))
	userID := strings.TrimSpace(c.Query("userId"))

	query := h.db.Model(&models.Subscription{})
	if tier != "" {
		query = query.Where("tier = ?", tier)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to count subscriptions"})
		return
	}
	var rows []models.Subscription
	if err := query.Preload("User").Order("updated_at DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch subscriptions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"subscriptions": rows, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) GetSubscription(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid subscription id"})
		return
	}
	var sub models.Subscription
	if err := h.db.Preload("User").First(&sub, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Subscription not found"})
		return
	}
	c.JSON(http.StatusOK, sub)
}

func (h *AdminHandler) CreateSubscription(c *gin.Context) {
	var req adminCreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	var user models.User
	if err := h.db.First(&user, req.UserID).Error; err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "USER_NOT_FOUND", Message: "User does not exist"})
		return
	}
	var existing models.Subscription
	if err := h.db.Where("user_id = ?", req.UserID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, ErrorResponse{Code: "SUBSCRIPTION_EXISTS", Message: "User already has a subscription; update it instead"})
		return
	}

	status := models.StatusActive
	if req.Status != "" {
		status = models.SubscriptionStatus(req.Status)
	}
	currency := strings.ToUpper(req.Currency)
	if currency == "" {
		currency = "USD"
	}
	amount := 0
	if req.AmountCents != nil {
		amount = *req.AmountCents
	}
	provider := req.BillingProvider
	if provider == "" {
		provider = "none"
	}

	sub := models.Subscription{
		UserID:          req.UserID,
		Tier:            models.SubscriptionTier(req.Tier),
		Status:          status,
		Currency:        currency,
		AmountCents:     amount,
		BillingProvider: provider,
	}
	if t, ok := parseOptionalTime(req.PeriodStart); ok {
		sub.PeriodStart = t
	}
	if t, ok := parseOptionalTime(req.PeriodEnd); ok {
		sub.PeriodEnd = t
	}
	if err := h.db.Create(&sub).Error; err != nil {
		slog.Error("Admin create subscription failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create subscription"})
		return
	}
	c.JSON(http.StatusCreated, sub)
}

func (h *AdminHandler) UpdateSubscription(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid subscription id"})
		return
	}
	var sub models.Subscription
	if err := h.db.First(&sub, id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Subscription not found"})
		return
	}
	var req adminUpdateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if req.UserID != nil && *req.UserID != sub.UserID {
		var clash models.Subscription
		if err := h.db.Where("user_id = ? AND id <> ?", *req.UserID, id).First(&clash).Error; err == nil {
			c.JSON(http.StatusConflict, ErrorResponse{Code: "SUBSCRIPTION_EXISTS", Message: "Target user already has a subscription"})
			return
		}
		if err := h.db.First(&models.User{}, *req.UserID).Error; err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Code: "USER_NOT_FOUND", Message: "User does not exist"})
			return
		}
		sub.UserID = *req.UserID
	}
	if req.Tier != nil {
		sub.Tier = models.SubscriptionTier(*req.Tier)
	}
	if req.Status != nil {
		sub.Status = models.SubscriptionStatus(*req.Status)
		if *req.Status == string(models.StatusCancelled) && sub.CancelledAt == nil {
			now := time.Now().UTC()
			sub.CancelledAt = &now
		}
	}
	if req.Currency != nil {
		sub.Currency = strings.ToUpper(*req.Currency)
	}
	if req.AmountCents != nil {
		sub.AmountCents = *req.AmountCents
	}
	if req.BillingProvider != nil {
		sub.BillingProvider = *req.BillingProvider
	}
	if req.PeriodStart != nil {
		if t, ok := parseOptionalTime(*req.PeriodStart); ok {
			sub.PeriodStart = t
		} else if *req.PeriodStart == "" {
			sub.PeriodStart = nil
		}
	}
	if req.PeriodEnd != nil {
		if t, ok := parseOptionalTime(*req.PeriodEnd); ok {
			sub.PeriodEnd = t
		} else if *req.PeriodEnd == "" {
			sub.PeriodEnd = nil
		}
	}
	if req.CancelledAt != nil {
		if t, ok := parseOptionalTime(*req.CancelledAt); ok {
			sub.CancelledAt = t
		} else if *req.CancelledAt == "" {
			sub.CancelledAt = nil
		}
	}
	if err := h.db.Save(&sub).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update subscription"})
		return
	}
	c.JSON(http.StatusOK, sub)
}

func (h *AdminHandler) DeleteSubscription(c *gin.Context) {
	id, err := parseUintParam(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid subscription id"})
		return
	}
	result := h.db.Delete(&models.Subscription{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete subscription"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Subscription not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Subscription deleted successfully"})
}

// ---------- Invoices / transactions ----------

type adminCreateInvoiceRequest struct {
	UserID      uint                   `json:"userId" binding:"required"`
	Reference   string                 `json:"reference" binding:"required,min=1,max=255"`
	AmountCents int                    `json:"amountCents" binding:"required"`
	Currency    string                 `json:"currency" binding:"required,len=3"`
	Status      string                 `json:"status" binding:"omitempty,oneof=pending paid failed"`
	LineItems   []models.InvoiceLineItem `json:"lineItems"`
	PaidAt      string                 `json:"paidAt"`
}

type adminUpdateInvoiceRequest struct {
	Reference   *string                  `json:"reference" binding:"omitempty,min=1,max=255"`
	AmountCents *int                     `json:"amountCents"`
	Currency    *string                  `json:"currency" binding:"omitempty,len=3"`
	Status      *string                  `json:"status" binding:"omitempty,oneof=pending paid failed"`
	LineItems   []models.InvoiceLineItem `json:"lineItems"`
	PaidAt      *string                  `json:"paidAt"`
	UserID      *uint                    `json:"userId"`
}

func (h *AdminHandler) ListInvoices(c *gin.Context) {
	limit := parseLimit(c.DefaultQuery("limit", "50"), 50, 200)
	offset := parseOffset(c.DefaultQuery("offset", "0"))
	status := strings.TrimSpace(c.Query("status"))
	userID := strings.TrimSpace(c.Query("userId"))
	search := strings.TrimSpace(c.Query("search"))

	query := h.db.Model(&models.Invoice{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if search != "" {
		query = query.Where("reference ILIKE ?", "%"+search+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to count invoices"})
		return
	}
	var rows []models.Invoice
	if err := query.Preload("User").Order("created_at DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to fetch invoices"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"invoices": rows, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) GetInvoice(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid invoice id"})
		return
	}
	var inv models.Invoice
	if err := h.db.Preload("User").First(&inv, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Invoice not found"})
		return
	}
	c.JSON(http.StatusOK, inv)
}

func (h *AdminHandler) CreateInvoice(c *gin.Context) {
	var req adminCreateInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if err := h.db.First(&models.User{}, req.UserID).Error; err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "USER_NOT_FOUND", Message: "User does not exist"})
		return
	}
	status := "pending"
	if req.Status != "" {
		status = req.Status
	}
	items := req.LineItems
	if items == nil {
		items = []models.InvoiceLineItem{}
	}
	itemsJSON, err := json.Marshal(items)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid line items"})
		return
	}
	inv := models.Invoice{
		UserID:      req.UserID,
		Reference:   strings.TrimSpace(req.Reference),
		AmountCents: req.AmountCents,
		Currency:    strings.ToUpper(req.Currency),
		Status:      status,
		LineItems:   datatypes.JSON(itemsJSON),
	}
	if t, ok := parseOptionalTime(req.PaidAt); ok {
		inv.PaidAt = t
	}
	if err := h.db.Create(&inv).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, ErrorResponse{Code: "REFERENCE_EXISTS", Message: "Invoice reference already exists"})
			return
		}
		slog.Error("Admin create invoice failed", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to create invoice"})
		return
	}
	c.JSON(http.StatusCreated, inv)
}

func (h *AdminHandler) UpdateInvoice(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid invoice id"})
		return
	}
	var inv models.Invoice
	if err := h.db.First(&inv, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Invoice not found"})
		return
	}
	var req adminUpdateInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	if req.UserID != nil {
		if err := h.db.First(&models.User{}, *req.UserID).Error; err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Code: "USER_NOT_FOUND", Message: "User does not exist"})
			return
		}
		inv.UserID = *req.UserID
	}
	if req.Reference != nil {
		inv.Reference = strings.TrimSpace(*req.Reference)
	}
	if req.AmountCents != nil {
		inv.AmountCents = *req.AmountCents
	}
	if req.Currency != nil {
		inv.Currency = strings.ToUpper(*req.Currency)
	}
	if req.Status != nil {
		inv.Status = *req.Status
		if *req.Status == "paid" && inv.PaidAt == nil {
			now := time.Now().UTC()
			inv.PaidAt = &now
		}
	}
	if req.LineItems != nil {
		b, err := json.Marshal(req.LineItems)
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid line items"})
			return
		}
		inv.LineItems = datatypes.JSON(b)
	}
	if req.PaidAt != nil {
		if t, ok := parseOptionalTime(*req.PaidAt); ok {
			inv.PaidAt = t
		} else if *req.PaidAt == "" {
			inv.PaidAt = nil
		}
	}
	if err := h.db.Save(&inv).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update invoice"})
		return
	}
	c.JSON(http.StatusOK, inv)
}

func (h *AdminHandler) DeleteInvoice(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid invoice id"})
		return
	}
	result := h.db.Where("id = ?", id).Delete(&models.Invoice{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to delete invoice"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "Invoice not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Invoice deleted successfully"})
}

func parseOptionalTime(raw string) (*time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, false
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return &t, true
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return &t, true
	}
	return nil, false
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique")
}
