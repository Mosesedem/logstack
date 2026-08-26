package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mosesedem/logstack/internal/models"
	"gorm.io/datatypes"
)

type retentionTierView struct {
	PlanID        uint   `json:"planId"`
	Tier          string `json:"tier"`
	Name          string `json:"name"`
	RetentionDays int    `json:"retentionDays"`
}

type retentionStatusResponse struct {
	Enabled      bool                `json:"enabled"`
	Interval     string              `json:"interval"`
	Tiers        []retentionTierView `json:"tiers"`
	ExpiredCount int64               `json:"expiredCount"`
	LastRun      any                 `json:"lastRun"`
}

type retentionUpdateBody struct {
	Enabled *bool `json:"enabled"`
	Tiers   []struct {
		Tier          string `json:"tier" binding:"required"`
		RetentionDays int    `json:"retentionDays"`
	} `json:"tiers"`
}

const maxRetentionDays = 3650 // 10 years

func (h *AdminHandler) GetLogRetention(c *gin.Context) {
	if h.retention == nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{Code: "UNAVAILABLE", Message: "Log retention worker is not running"})
		return
	}
	ctx := c.Request.Context()
	enabled, err := h.retention.IsEnabled(ctx)
	if err != nil {
		slog.Error("admin get retention enabled", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to load retention settings"})
		return
	}
	var plans []models.PricingPlan
	if err := h.db.Order("sort_order ASC, id ASC").Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to load pricing plans"})
		return
	}
	tiers := make([]retentionTierView, 0, len(plans))
	seen := map[string]bool{}
	for _, p := range plans {
		tiers = append(tiers, retentionTierView{
			PlanID:        p.ID,
			Tier:          p.Tier,
			Name:          p.Name,
			RetentionDays: p.RetentionDays,
		})
		seen[p.Tier] = true
	}
	for _, t := range []models.SubscriptionTier{
		models.TierFree, models.TierStarter, models.TierPro, models.TierEnterprise,
	} {
		if seen[string(t)] {
			continue
		}
		tiers = append(tiers, retentionTierView{
			Tier:          string(t),
			Name:          string(t),
			RetentionDays: models.DefaultRetentionDays(t),
		})
	}

	lastRun, err := h.retention.LastRun(ctx)
	if err != nil {
		slog.Error("admin last retention run", "error", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to load last cleanup"})
		return
	}

	// COUNT over logs can take minutes on a large table and the proxy then
	// returns 502 with no CORS headers. Keep the page load cheap.
	var expired int64
	countCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	expired, err = h.retention.CountExpired(countCtx)
	if err != nil {
		slog.Warn("admin count expired logs skipped", "error", err)
		expired = 0
	}

	c.JSON(http.StatusOK, retentionStatusResponse{
		Enabled:      enabled,
		Interval:     h.retention.Interval().String(),
		Tiers:        tiers,
		ExpiredCount: expired,
		LastRun:      lastRun,
	})
}

func (h *AdminHandler) UpdateLogRetention(c *gin.Context) {
	if h.retention == nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{Code: "UNAVAILABLE", Message: "Log retention worker is not running"})
		return
	}
	var req retentionUpdateBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: err.Error()})
		return
	}
	ctx := c.Request.Context()
	if req.Enabled != nil {
		if err := h.retention.SetEnabled(ctx, *req.Enabled); err != nil {
			slog.Error("admin set retention enabled", "error", err)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to update enabled flag"})
			return
		}
	}
	for _, t := range req.Tiers {
		if !models.SubscriptionTier(t.Tier).IsValid() {
			c.JSON(http.StatusBadRequest, ErrorResponse{Code: "VALIDATION_ERROR", Message: "Invalid tier: " + t.Tier})
			return
		}
		if t.RetentionDays < 0 || t.RetentionDays > maxRetentionDays {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Code:    "VALIDATION_ERROR",
				Message: "retentionDays must be between 0 (forever) and 3650",
			})
			return
		}
		var plan models.PricingPlan
		if err := h.db.Where("tier = ?", t.Tier).First(&plan).Error; err != nil {
			c.JSON(http.StatusNotFound, ErrorResponse{Code: "NOT_FOUND", Message: "No pricing plan for tier " + t.Tier})
			return
		}
		plan.RetentionDays = t.RetentionDays
		limits := map[string]string{}
		if len(plan.Limits) > 0 {
			_ = json.Unmarshal(plan.Limits, &limits)
		}
		limits["retention"] = models.FormatRetentionDays(t.RetentionDays)
		if b, err := json.Marshal(limits); err == nil {
			plan.Limits = datatypes.JSON(b)
		}
		if err := h.db.Save(&plan).Error; err != nil {
			slog.Error("admin save retention days", "error", err, "tier", t.Tier)
			c.JSON(http.StatusInternalServerError, ErrorResponse{Code: "INTERNAL_ERROR", Message: "Failed to save retention for " + t.Tier})
			return
		}
	}
	h.GetLogRetention(c)
}

func (h *AdminHandler) RunLogRetention(c *gin.Context) {
	if h.retention == nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{Code: "UNAVAILABLE", Message: "Log retention worker is not running"})
		return
	}
	result := h.retention.Run(c.Request.Context(), "admin")
	c.JSON(http.StatusOK, result)
}
