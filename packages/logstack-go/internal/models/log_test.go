package models

import "testing"

func TestLogLevelIsValid(t *testing.T) {
	valid := []LogLevel{
		LogLevelDebug,
		LogLevelInfo,
		LogLevelWarn,
		LogLevelError,
		LogLevelCritical,
		LogLevelFatal,
	}
	for _, level := range valid {
		if !level.IsValid() {
			t.Fatalf("expected %q to be valid", level)
		}
	}

	if LogLevel("trace").IsValid() {
		t.Fatal("expected trace to be invalid")
	}
}