package middleware

import (
	"github.com/mosesedem/logstack/internal/models"
)

// FeatureMatrix maps each subscription tier to the set of features it includes.
var FeatureMatrix = map[models.SubscriptionTier][]string{
	models.TierFree: {
		"basic_alerts",
		"email_alerts",
	},
	models.TierStarter: {
		"basic_alerts",
		"email_alerts",
		"webhook_alerts",
		"advanced_filters",
	},
	models.TierPro: {
		"basic_alerts",
		"email_alerts",
		"webhook_alerts",
		"advanced_filters",
		"advanced_alerts",
		"team_management",
	},
	models.TierEnterprise: {
		"basic_alerts",
		"email_alerts",
		"webhook_alerts",
		"advanced_filters",
		"advanced_alerts",
		"team_management",
		"sso",
		"audit_logs",
		"custom_retention",
	},
}

// TierHasFeature reports whether the given subscription tier includes the named feature.
func TierHasFeature(tier models.SubscriptionTier, feature string) bool {
	features, ok := FeatureMatrix[tier]
	if !ok {
		return false
	}
	for _, f := range features {
		if f == feature {
			return true
		}
	}
	return false
}
