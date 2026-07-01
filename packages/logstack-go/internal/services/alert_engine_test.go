package services

import (
	"regexp"
	"testing"

	"github.com/mosesedem/logstack/internal/models"
)

func TestLogLevelAtOrAbove(t *testing.T) {
	tests := []struct {
		logLevel models.LogLevel
		minLevel models.LogLevel
		want     bool
	}{
		{models.LogLevelError, models.LogLevelError, true},
		{models.LogLevelCritical, models.LogLevelError, true},
		{models.LogLevelWarn, models.LogLevelError, false},
		{models.LogLevelInfo, models.LogLevelWarn, false},
		{models.LogLevelWarn, models.LogLevelWarn, true},
		{models.LogLevelFatal, models.LogLevelError, true},
	}

	for _, tc := range tests {
		if got := logLevelAtOrAbove(tc.logLevel, tc.minLevel); got != tc.want {
			t.Fatalf("logLevelAtOrAbove(%q, %q) = %v, want %v", tc.logLevel, tc.minLevel, got, tc.want)
		}
	}
}

func TestAlertEngineMatchesPatternsAndLevel(t *testing.T) {
	engine := &AlertEngine{regexCache: make(map[string]*regexp.Regexp)}

	rule := models.AlertRule{
		ID:              1,
		TriggerLevel:    models.LogLevelError,
		TriggerPatterns: []string{`.*error.*`, `.*exception.*`},
	}

	matchingLog := &models.Log{
		Level:   models.LogLevelError,
		Message: "Payment authorization error: card declined",
	}
	if !engine.matches(rule, matchingLog) {
		t.Fatal("expected error log with matching pattern to trigger alert")
	}

	nonMatchingMessage := &models.Log{
		Level:   models.LogLevelError,
		Message: "Payment authorization failed",
	}
	if engine.matches(rule, nonMatchingMessage) {
		t.Fatal("expected log without pattern match to not trigger alert")
	}

	lowLevelLog := &models.Log{
		Level:   models.LogLevelInfo,
		Message: "application error during startup",
	}
	if engine.matches(rule, lowLevelLog) {
		t.Fatal("expected info log below trigger level to not trigger alert")
	}
}