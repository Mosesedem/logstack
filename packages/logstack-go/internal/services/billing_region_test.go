package services

import (
	"testing"

	"github.com/mosesedem/logstack/internal/models"
)

func TestResolveBillingContext_Nigeria(t *testing.T) {
	country := "NG"
	ctx := ResolveBillingContext(&country)
	if ctx.Provider != BillingProviderPaystack {
		t.Fatalf("expected paystack, got %s", ctx.Provider)
	}
	if ctx.Currency != "NGN" {
		t.Fatalf("expected NGN, got %s", ctx.Currency)
	}
	if !ctx.IsNigeria {
		t.Fatal("expected isNigeria true")
	}
}

func TestResolveBillingContext_International(t *testing.T) {
	country := "US"
	ctx := ResolveBillingContext(&country)
	if ctx.Provider != BillingProviderPolar {
		t.Fatalf("expected polar, got %s", ctx.Provider)
	}
	if ctx.Currency != "USD" {
		t.Fatalf("expected USD, got %s", ctx.Currency)
	}
	if ctx.CountryRequired {
		t.Fatal("expected countryRequired false when country set")
	}
}

func TestResolveBillingContext_EmptyCountry(t *testing.T) {
	ctx := ResolveBillingContext(nil)
	if !ctx.CountryRequired {
		t.Fatal("expected countryRequired when country unset")
	}
	if ctx.Currency != "USD" {
		t.Fatalf("expected USD default, got %s", ctx.Currency)
	}
}

func TestCurrencyForCountry(t *testing.T) {
	if CurrencyForCountry("ng") != "NGN" {
		t.Fatal("expected NGN for ng")
	}
	if CurrencyForCountry("US") != "USD" {
		t.Fatal("expected USD for US")
	}
}

func TestFilterPricingTiersForCurrency(t *testing.T) {
	tiers := models.GetPricingTiers()
	filtered := FilterPricingTiersForCurrency(tiers, "NGN")
	if len(filtered[1].Prices) != 1 {
		t.Fatalf("expected single currency in filtered tier, got %d", len(filtered[1].Prices))
	}
	if _, ok := filtered[1].Prices["NGN"]; !ok {
		t.Fatal("expected NGN price key")
	}
}