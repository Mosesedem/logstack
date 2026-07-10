package models

import (
	"encoding/json"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// PricingPlan is the DB-backed, admin-editable pricing plan (maps to public PricingTier).
type PricingPlan struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Tier        string         `gorm:"size:20;uniqueIndex;not null" json:"tier"` // free|starter|pro|enterprise
	Name        string         `gorm:"size:100;not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	LogLimit    int64          `gorm:"not null;default:10000" json:"logLimit"`
	Features    datatypes.JSON `gorm:"type:jsonb;not null" json:"features"` // []string
	Prices      datatypes.JSON `gorm:"type:jsonb;not null" json:"prices"`   // map[string]int currency→cents
	Limits      datatypes.JSON `gorm:"type:jsonb;not null" json:"limits"`   // map[string]string
	SortOrder   int            `gorm:"not null;default:0" json:"sortOrder"`
	Active      bool           `gorm:"not null;default:true" json:"active"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

func (PricingPlan) TableName() string {
	return "pricing_plans"
}

// ToPricingTier converts a DB plan into the public PricingTier shape.
func (p *PricingPlan) ToPricingTier() PricingTier {
	features := decodeStringSlice(p.Features)
	prices := decodeIntMap(p.Prices)
	limits := decodeStringMap(p.Limits)
	return PricingTier{
		Tier:        SubscriptionTier(p.Tier),
		Name:        p.Name,
		Description: p.Description,
		LogLimit:    p.LogLimit,
		Features:    features,
		Prices:      prices,
		Limits:      limits,
	}
}

// DefaultPricingTiers returns the built-in catalogue used for seeding and fallback.
func DefaultPricingTiers() []PricingTier {
	return []PricingTier{
		{
			Tier:        TierFree,
			Name:        "Free",
			Description: "Perfect for personal projects and getting started",
			LogLimit:    10_000,
			Features: []string{
				"10,000 logs per month",
				"7-day log retention",
				"1 project",
				"Email alerts",
				"Community support",
			},
			Prices: map[string]int{"USD": 0, "NGN": 0},
			Limits: map[string]string{
				"logs": "10,000/month", "retention": "7 days", "projects": "1 project",
			},
		},
		{
			Tier:        TierStarter,
			Name:        "Starter",
			Description: "For small teams and growing applications",
			LogLimit:    500_000,
			Features: []string{
				"500,000 logs per month",
				"30-day log retention",
				"3 projects",
				"Up to 3 team members",
				"Email & Slack alerts",
				"Priority support",
				"API access",
			},
			Prices: map[string]int{"USD": 1500, "NGN": 12000},
			Limits: map[string]string{
				"logs": "500,000/month", "retention": "30 days", "projects": "3 projects",
			},
		},
		{
			Tier:        TierPro,
			Name:        "Pro",
			Description: "For larger teams with advanced needs",
			LogLimit:    5_000_000,
			Features: []string{
				"5,000,000 logs per month",
				"90-day log retention",
				"Unlimited projects",
				"Up to 10 team members",
				"All alert channels",
				"Custom dashboards",
				"Team collaboration",
				"Priority support",
			},
			Prices: map[string]int{"USD": 4900, "NGN": 38000},
			Limits: map[string]string{
				"logs": "5M/month", "retention": "90 days", "projects": "Unlimited",
			},
		},
		{
			Tier:        TierEnterprise,
			Name:        "Enterprise",
			Description: "Custom solutions for large organizations",
			LogLimit:    -1,
			Features: []string{
				"Unlimited logs",
				"Custom retention",
				"Unlimited projects",
				"SSO & SAML",
				"Dedicated support",
				"SLA guarantee",
				"On-premise option",
			},
			Prices: map[string]int{"USD": -1, "NGN": -1},
			Limits: map[string]string{
				"logs": "Unlimited", "retention": "Custom", "projects": "Unlimited",
			},
		},
	}
}

// GetPricingTiers returns active plans from the DB, falling back to defaults.
// Prefer LoadPricingTiers(db) when a DB handle is available.
func GetPricingTiers() []PricingTier {
	return DefaultPricingTiers()
}

// LoadPricingTiers loads active pricing plans ordered by sort_order.
// Falls back to DefaultPricingTiers if the table is empty or query fails.
func LoadPricingTiers(db *gorm.DB) []PricingTier {
	if db == nil {
		return DefaultPricingTiers()
	}
	var plans []PricingPlan
	if err := db.Where("active = ?", true).Order("sort_order ASC, id ASC").Find(&plans).Error; err != nil {
		return DefaultPricingTiers()
	}
	if len(plans) == 0 {
		return DefaultPricingTiers()
	}
	out := make([]PricingTier, len(plans))
	for i := range plans {
		out[i] = plans[i].ToPricingTier()
	}
	return out
}

// PricingPlanFromTier builds a PricingPlan row from a PricingTier (for seed/create).
func PricingPlanFromTier(t PricingTier, sortOrder int) (PricingPlan, error) {
	features, err := json.Marshal(t.Features)
	if err != nil {
		return PricingPlan{}, err
	}
	prices, err := json.Marshal(t.Prices)
	if err != nil {
		return PricingPlan{}, err
	}
	limits, err := json.Marshal(t.Limits)
	if err != nil {
		return PricingPlan{}, err
	}
	return PricingPlan{
		Tier:        string(t.Tier),
		Name:        t.Name,
		Description: t.Description,
		LogLimit:    t.LogLimit,
		Features:    datatypes.JSON(features),
		Prices:      datatypes.JSON(prices),
		Limits:      datatypes.JSON(limits),
		SortOrder:   sortOrder,
		Active:      true,
	}, nil
}

func decodeStringSlice(raw datatypes.JSON) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal(raw, &out); err != nil {
		return []string{}
	}
	return out
}

func decodeIntMap(raw datatypes.JSON) map[string]int {
	if len(raw) == 0 {
		return map[string]int{}
	}
	var out map[string]int
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]int{}
	}
	return out
}

func decodeStringMap(raw datatypes.JSON) map[string]string {
	if len(raw) == 0 {
		return map[string]string{}
	}
	var out map[string]string
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]string{}
	}
	return out
}
