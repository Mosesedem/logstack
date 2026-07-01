package services

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
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
	regexCache   map[string]*regexp.Regexp
	regexCacheMu sync.RWMutex
}

func NewAlertEngine(db *gorm.DB, redis *redis.Client, notifier *notification.Service) *AlertEngine {
	return &AlertEngine{
		db:         db,
		redis:      redis,
		notifier:   notifier,
		regexCache: make(map[string]*regexp.Regexp),
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
	if !e.matches(rule, log) {
		return nil
	}

	cooldownKey := fmt.Sprintf("alert:%d:cooldown", rule.ID)
	acquired, err := e.redis.SetNX(ctx, cooldownKey, "1", time.Duration(rule.CooldownMinutes)*time.Minute).Result()
	if err != nil {
		return err
	}
	if !acquired {
		slog.Info("alert skipped: cooldown active",
			"ruleId", rule.ID,
			"logId", log.ID,
			"cooldownMinutes", rule.CooldownMinutes,
		)
		return nil
	}

	// Send notification
	var alertStatus models.AlertStatus
	var errorMessage string

	if err := e.notifier.Send(ctx, &rule, log); err != nil {
		e.redis.Del(ctx, cooldownKey)
		alertStatus = models.AlertStatusFailed
		errorMessage = err.Error()
	} else {
		alertStatus = models.AlertStatusSuccess
	}

	history := models.AlertHistory{
		AlertRuleID:  rule.ID,
		Status:       alertStatus,
		ErrorMessage: errorMessage,
	}
	if log.ID > 0 {
		history.LogID = &log.ID
	}
	if err := e.db.Create(&history).Error; err != nil {
		e.redis.Del(ctx, cooldownKey)
		return err
	}

	return nil
}

// SendTestNotification delivers a demo/test alert email, bypassing match rules and cooldown.
func (e *AlertEngine) SendTestNotification(ctx context.Context, ruleID uint) error {
	rule, err := e.GetRule(ctx, ruleID)
	if err != nil {
		return err
	}

	testLog := &models.Log{
		Level:     models.LogLevelError,
		Message:   "Logstack demo test — payment authorization error (simulated)",
		Source:    "sdk-demo",
		CreatedAt: time.Now(),
		ProjectID: rule.ProjectID,
	}

	var alertStatus models.AlertStatus
	var errorMessage string
	if err := e.notifier.Send(ctx, rule, testLog); err != nil {
		alertStatus = models.AlertStatusFailed
		errorMessage = err.Error()
	} else {
		alertStatus = models.AlertStatusSuccess
	}

	history := models.AlertHistory{
		AlertRuleID:  rule.ID,
		Status:       alertStatus,
		ErrorMessage: errorMessage,
	}
	if err := e.db.Create(&history).Error; err != nil {
		return err
	}
	if alertStatus == models.AlertStatusFailed {
		return fmt.Errorf("%s", errorMessage)
	}
	return nil
}

var logLevelRank = map[models.LogLevel]int{
	models.LogLevelDebug:    0,
	models.LogLevelInfo:     1,
	models.LogLevelWarn:     2,
	models.LogLevelError:    3,
	models.LogLevelCritical: 4,
	models.LogLevelFatal:    5,
}

func logLevelAtOrAbove(logLevel, minLevel models.LogLevel) bool {
	if minLevel == "" {
		return true
	}
	return logLevelRank[logLevel] >= logLevelRank[minLevel]
}

func (e *AlertEngine) matches(rule models.AlertRule, log *models.Log) bool {
	if rule.TriggerLevel != "" && !logLevelAtOrAbove(log.Level, rule.TriggerLevel) {
		return false
	}

	patterns := []string(rule.TriggerPatterns)
	if len(patterns) == 0 && rule.TriggerPattern != "" {
		patterns = []string{rule.TriggerPattern}
	}

	if len(patterns) > 0 {
		for _, pattern := range patterns {
			if e.matchPattern(rule.ID, pattern, log.Message) {
				return true
			}
		}
		return false
	}

	// Level-only rules: fire when the level matches and no patterns are set.
	return rule.TriggerLevel != ""
}

func (e *AlertEngine) matchPattern(ruleID uint, pattern, message string) bool {
	cacheKey := strconv.FormatUint(uint64(ruleID), 10) + ":" + pattern

	e.regexCacheMu.RLock()
	re, exists := e.regexCache[cacheKey]
	e.regexCacheMu.RUnlock()

	if !exists {
		compiled, err := regexp.Compile(pattern)
		if err != nil {
			return false
		}
		e.regexCacheMu.Lock()
		e.regexCache[cacheKey] = compiled
		e.regexCacheMu.Unlock()
		re = compiled
	}

	return re.MatchString(message)
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
