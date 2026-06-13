package services

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"sync"
	"time"

	"github.com/mosesedem/logstack/internal/models"
	"github.com/mosesedem/logstack/internal/services/notification"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type AlertEngine struct {
	db           *gorm.DB
	redis        *redis.Client
	notifier     *notification.Service
	regexCache   map[uint]*regexp.Regexp
	regexCacheMu sync.RWMutex
}

func NewAlertEngine(db *gorm.DB, redis *redis.Client, notifier *notification.Service) *AlertEngine {
	return &AlertEngine{
		db:         db,
		redis:      redis,
		notifier:   notifier,
		regexCache: make(map[uint]*regexp.Regexp),
	}
}

func (e *AlertEngine) ProcessLog(ctx context.Context, log *models.Log) error {
	// Note: Removed production-only restriction
	// Alert rules can now fire for any environment

	// Fetch active alert rules for this project
	var rules []models.AlertRule
	if err := e.db.WithContext(ctx).
		Where("project_id = ? AND enabled = true", log.ProjectID).
		Find(&rules).Error; err != nil {
		return err
	}

	for _, rule := range rules {
		if err := e.processRule(ctx, rule, log); err != nil {
			// Log error but continue processing other rules
			slog.Error("Error processing alert rule", "ruleId", rule.ID, "error", err)
		}
	}

	return nil
}

func (e *AlertEngine) processRule(ctx context.Context, rule models.AlertRule, log *models.Log) error {
	// Check if rule matches
	if !e.matches(rule, log) {
		return nil
	}

	// Check cooldown
	cooldownKey := fmt.Sprintf("alert:%d:cooldown", rule.ID)
	exists, err := e.redis.Exists(ctx, cooldownKey).Result()
	if err != nil {
		return err
	}
	if exists > 0 {
		return nil // Still in cooldown
	}

	// Send notification
	var alertStatus models.AlertStatus
	var errorMessage string

	if err := e.notifier.Send(ctx, &rule, log); err != nil {
		alertStatus = models.AlertStatusFailed
		errorMessage = err.Error()
	} else {
		alertStatus = models.AlertStatusSuccess
	}

	// Record alert history
	history := models.AlertHistory{
		AlertRuleID:  rule.ID,
		LogID:        &log.ID,
		Status:       alertStatus,
		ErrorMessage: errorMessage,
	}
	if err := e.db.Create(&history).Error; err != nil {
		return err
	}

	// Set cooldown only on success
	if alertStatus == models.AlertStatusSuccess {
		e.redis.Set(ctx, cooldownKey, "1", time.Duration(rule.CooldownMinutes)*time.Minute)
	}

	return nil
}

func (e *AlertEngine) matches(rule models.AlertRule, log *models.Log) bool {
	// Level filter
	if rule.TriggerLevel != "" && rule.TriggerLevel != log.Level {
		return false
	}

	// Pattern matching (regex or keyword)
	if rule.TriggerPattern != "" {
		// Use cached regex for performance
		e.regexCacheMu.RLock()
		re, exists := e.regexCache[rule.ID]
		e.regexCacheMu.RUnlock()

		if !exists {
			// Compile and cache the regex
			compiled, err := regexp.Compile(rule.TriggerPattern)
			if err != nil {
				// Invalid regex - don't match
				return false
			}
			e.regexCacheMu.Lock()
			e.regexCache[rule.ID] = compiled
			e.regexCacheMu.Unlock()
			re = compiled
		}

		return re.MatchString(log.Message)
	}

	// If no pattern is specified but level matches, return true
	// This allows level-only alert rules
	return rule.TriggerLevel != ""
}

// GetRulesForProject returns all alert rules for a project
func (e *AlertEngine) GetRulesForProject(ctx context.Context, projectID string) ([]models.AlertRule, error) {
	var rules []models.AlertRule
	if err := e.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&rules).Error; err != nil {
		return nil, err
	}
	return rules, nil
}

// CreateRule creates a new alert rule
func (e *AlertEngine) CreateRule(ctx context.Context, rule *models.AlertRule) error {
	return e.db.WithContext(ctx).Create(rule).Error
}

// UpdateRule updates an existing alert rule
func (e *AlertEngine) UpdateRule(ctx context.Context, rule *models.AlertRule) error {
	return e.db.WithContext(ctx).Save(rule).Error
}

// DeleteRule deletes an alert rule
func (e *AlertEngine) DeleteRule(ctx context.Context, id uint) error {
	return e.db.WithContext(ctx).Delete(&models.AlertRule{}, id).Error
}

// GetRule returns a single alert rule
func (e *AlertEngine) GetRule(ctx context.Context, id uint) (*models.AlertRule, error) {
	var rule models.AlertRule
	if err := e.db.WithContext(ctx).First(&rule, id).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

// GetAlertHistory returns alert history for a rule
func (e *AlertEngine) GetAlertHistory(ctx context.Context, ruleID uint, limit int) ([]models.AlertHistory, error) {
	var history []models.AlertHistory
	if err := e.db.WithContext(ctx).
		Where("alert_rule_id = ?", ruleID).
		Order("sent_at DESC").
		Limit(limit).
		Preload("Log").
		Find(&history).Error; err != nil {
		return nil, err
	}
	return history, nil
}
