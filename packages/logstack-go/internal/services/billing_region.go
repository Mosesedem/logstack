package services

import "github.com/mosesedem/logstack/internal/models"

const (
	BillingProviderPaystack = "paystack"
	BillingProviderPolar    = "polar"
	BillingProviderNone     = "none"
)

// BillingContext describes which provider and currency apply for a user.
type BillingContext struct {
	Provider        string `json:"provider"`
	Currency        string `json:"currency"`
	Country         string `json:"country"`
	IsNigeria       bool   `json:"isNigeria"`
	PaymentLabel    string `json:"paymentLabel"`
}

// ResolveBillingContext returns the billing provider and currency for a user country.
// Nigerian users (country NG) use Paystack with NGN; all others use Polar with USD.
func ResolveBillingContext(country *string) BillingContext {
	code := ""
	if country != nil {
		code = *country
	}
	if code == "NG" {
		return BillingContext{
			Provider:     BillingProviderPaystack,
			Currency:     "NGN",
			Country:      "NG",
			IsNigeria:    true,
			PaymentLabel: "Paystack",
		}
	}
	return BillingContext{
		Provider:     BillingProviderPolar,
		Currency:     "USD",
		Country:      code,
		IsNigeria:    false,
		PaymentLabel: "Polar",
	}
}

// FilterPricingTiersForCurrency returns tiers with only the relevant currency price.
func FilterPricingTiersForCurrency(tiers []models.PricingTier, currency string) []models.PricingTier {
	filtered := make([]models.PricingTier, len(tiers))
	for i, tier := range tiers {
		filtered[i] = tier
		price, ok := tier.Prices[currency]
		if ok {
			filtered[i].Prices = map[string]int{currency: price}
		} else {
			filtered[i].Prices = map[string]int{currency: 0}
		}
	}
	return filtered
}