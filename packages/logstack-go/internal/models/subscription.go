package models

import (
	"database/sql/driver"
	"errors"
	"time"

	"github.com/google/uuid"
)

// SubscriptionTier represents the subscription tier level
type SubscriptionTier string

const (
	TierFree       SubscriptionTier = "free"
	TierStarter    SubscriptionTier = "starter"
	TierPro        SubscriptionTier = "pro"
	TierEnterprise SubscriptionTier = "enterprise"
)

// IsValid validates the subscription tier
func (t SubscriptionTier) IsValid() bool {
	switch t {
	case TierFree, TierStarter, TierPro, TierEnterprise:
		return true
	}
	return false
}

// LogLimit returns the monthly log limit for the tier
func (t SubscriptionTier) LogLimit() int64 {
	switch t {
	case TierFree:
		return 10_000 // 10k logs (optimized for conversion)
	case TierStarter:
		return 500_000 // 500k logs
	case TierPro:
		return 5_000_000 // 5M logs
	case TierEnterprise:
		return -1 // Unlimited
	}
	return 10_000 // Default to free tier
}

// Scan implements the sql.Scanner interface
func (t *SubscriptionTier) Scan(value interface{}) error {
	if value == nil {
		*t = TierFree
		return nil
	}
	strVal, ok := value.(string)
	if !ok {
		return errors.New("invalid type for SubscriptionTier")
	}
	*t = SubscriptionTier(strVal)
	return nil
}

// Value implements the driver.Valuer interface
func (t SubscriptionTier) Value() (driver.Value, error) {
	return string(t), nil
}

// SubscriptionStatus represents the subscription status
type SubscriptionStatus string

const (
	StatusActive    SubscriptionStatus = "active"
	StatusCancelled SubscriptionStatus = "cancelled"
	StatusPastDue   SubscriptionStatus = "past_due"
	StatusTrialing  SubscriptionStatus = "trialing"
	StatusPaused    SubscriptionStatus = "paused"
)

// IsValid validates the subscription status
func (s SubscriptionStatus) IsValid() bool {
	switch s {
	case StatusActive, StatusCancelled, StatusPastDue, StatusTrialing, StatusPaused:
		return true
	}
	return false
}

// IsUsable returns true if the subscription allows service usage
func (s SubscriptionStatus) IsUsable() bool {
	return s == StatusActive || s == StatusTrialing
}

// Scan implements the sql.Scanner interface
func (s *SubscriptionStatus) Scan(value interface{}) error {
	if value == nil {
		*s = StatusActive
		return nil
	}
	strVal, ok := value.(string)
	if !ok {
		return errors.New("invalid type for SubscriptionStatus")
	}
	*s = SubscriptionStatus(strVal)
	return nil
}

// Value implements the driver.Valuer interface
func (s SubscriptionStatus) Value() (driver.Value, error) {
	return string(s), nil
}

// Subscription represents a user's subscription
type Subscription struct {
	ID                       uint               `gorm:"primaryKey" json:"id"`
	UserID                   uint               `gorm:"uniqueIndex;not null" json:"userId"`
	OrganizationID           *uuid.UUID         `gorm:"type:uuid;index" json:"organizationId"`
	Tier                     SubscriptionTier   `gorm:"type:subscription_tier;default:'free'" json:"tier"`
	Status                   SubscriptionStatus `gorm:"type:subscription_status;default:'active'" json:"status"`
	PaystackCustomerCode     *string            `gorm:"size:100" json:"paystackCustomerCode,omitempty"`
	PaystackSubscriptionCode *string            `gorm:"size:100" json:"paystackSubscriptionCode,omitempty"`
	PaystackPlanCode         *string            `gorm:"size:100" json:"paystackPlanCode,omitempty"`
	BillingProvider          string             `gorm:"size:20;default:'none'" json:"billingProvider"`
	PolarSubscriptionID      *string            `gorm:"size:100" json:"polarSubscriptionId,omitempty"`
	PolarCustomerID          *string            `gorm:"size:100" json:"polarCustomerId,omitempty"`
	Currency                 string             `gorm:"size:3;default:'USD'" json:"currency"`
	AmountCents              int                `gorm:"default:0" json:"amountCents"`
	PeriodStart              *time.Time         `json:"periodStart,omitempty"`
	PeriodEnd                *time.Time         `json:"periodEnd,omitempty"`
	CancelledAt              *time.Time         `json:"cancelledAt,omitempty"`
	CreatedAt                time.Time          `json:"createdAt"`
	UpdatedAt                time.Time          `json:"updatedAt"`

	// Relations
	User         User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Organization *Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
}

// TableName specifies the table name for GORM
func (Subscription) TableName() string {
	return "subscriptions"
}

// SubscriptionResponse is the API response for a subscription
type SubscriptionResponse struct {
	ID          uint               `json:"id"`
	UserID      uint               `json:"userId"`
	Tier        SubscriptionTier   `json:"tier"`
	Status      SubscriptionStatus `json:"status"`
	Currency    string             `json:"currency"`
	AmountCents int                `json:"amountCents"`
	PeriodStart *time.Time         `json:"periodStart,omitempty"`
	PeriodEnd   *time.Time         `json:"periodEnd,omitempty"`
	LogLimit    int64              `json:"logLimit"`
	CreatedAt   time.Time          `json:"createdAt"`
}

// ToResponse converts a Subscription to SubscriptionResponse
func (s *Subscription) ToResponse() SubscriptionResponse {
	return SubscriptionResponse{
		ID:          s.ID,
		UserID:      s.UserID,
		Tier:        s.Tier,
		Status:      s.Status,
		Currency:    s.Currency,
		AmountCents: s.AmountCents,
		PeriodStart: s.PeriodStart,
		PeriodEnd:   s.PeriodEnd,
		LogLimit:    s.Tier.LogLimit(),
		CreatedAt:   s.CreatedAt,
	}
}

// PricingTier represents the pricing information for a tier (public API shape).
// Editable catalogue lives in PricingPlan; see DefaultPricingTiers / LoadPricingTiers.
type PricingTier struct {
	Tier        SubscriptionTier  `json:"tier"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	LogLimit    int64             `json:"logLimit"`
	Features    []string          `json:"features"`
	Prices      map[string]int    `json:"prices"` // Currency -> amount in cents
	Limits      map[string]string `json:"limits"` // Human-readable limits
}
