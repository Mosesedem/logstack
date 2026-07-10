package notification

import (
	"log/slog"
	"sync"
	"time"
)

// PushTraceEvent is one step in the push delivery pipeline (register → FCM send → result).
type PushTraceEvent struct {
	At          time.Time `json:"at"`
	Phase       string    `json:"phase"`
	Source      string    `json:"source"`
	UserID      uint      `json:"userId"`
	DeviceType  string    `json:"deviceType,omitempty"`
	MaskedToken string    `json:"maskedToken,omitempty"`
	Title       string    `json:"title,omitempty"`
	PayloadKind string    `json:"payloadKind,omitempty"`
	MessageID   string    `json:"messageId,omitempty"`
	Error       string    `json:"error,omitempty"`
	IOSTokens   int       `json:"iosTokens,omitempty"`
	IOSSent     int       `json:"iosSent,omitempty"`
	IOSFailed   int       `json:"iosFailed,omitempty"`
	AndroidTokens int     `json:"androidTokens,omitempty"`
	AndroidSent   int     `json:"androidSent,omitempty"`
	AndroidFailed int     `json:"androidFailed,omitempty"`
	Detail      string    `json:"detail,omitempty"`
}

const pushTraceMaxEvents = 200

var (
	pushTraceMu     sync.RWMutex
	pushTraceEvents []PushTraceEvent
)

// RecordPushTrace stores an event and emits a grep-friendly structured log line.
func RecordPushTrace(ev PushTraceEvent) {
	if ev.At.IsZero() {
		ev.At = time.Now().UTC()
	}

	pushTraceMu.Lock()
	pushTraceEvents = append(pushTraceEvents, ev)
	if len(pushTraceEvents) > pushTraceMaxEvents {
		pushTraceEvents = pushTraceEvents[len(pushTraceEvents)-pushTraceMaxEvents:]
	}
	pushTraceMu.Unlock()

	attrs := []any{
		"event", "push_trace",
		"phase", ev.Phase,
		"source", ev.Source,
		"userId", ev.UserID,
	}
	if ev.DeviceType != "" {
		attrs = append(attrs, "deviceType", ev.DeviceType)
	}
	if ev.MaskedToken != "" {
		attrs = append(attrs, "maskedToken", ev.MaskedToken)
	}
	if ev.Title != "" {
		attrs = append(attrs, "title", ev.Title)
	}
	if ev.PayloadKind != "" {
		attrs = append(attrs, "payloadKind", ev.PayloadKind)
	}
	if ev.MessageID != "" {
		attrs = append(attrs, "messageId", ev.MessageID)
	}
	if ev.Error != "" {
		attrs = append(attrs, "error", ev.Error)
	}
	if ev.IOSTokens > 0 || ev.IOSSent > 0 || ev.IOSFailed > 0 {
		attrs = append(attrs, "iosTokens", ev.IOSTokens, "iosSent", ev.IOSSent, "iosFailed", ev.IOSFailed)
	}
	if ev.AndroidTokens > 0 || ev.AndroidSent > 0 || ev.AndroidFailed > 0 {
		attrs = append(attrs, "androidTokens", ev.AndroidTokens, "androidSent", ev.AndroidSent, "androidFailed", ev.AndroidFailed)
	}
	if ev.Detail != "" {
		attrs = append(attrs, "detail", ev.Detail)
	}

	level := slog.LevelInfo
	if ev.Phase == "send_fail" || ev.Phase == "send_done_fail" {
		level = slog.LevelWarn
	}
	slog.Log(nil, level, "push_trace", attrs...)
}

// RecentPushTrace returns the newest [limit] events (default all, capped at max buffer).
func RecentPushTrace(limit int) []PushTraceEvent {
	pushTraceMu.RLock()
	defer pushTraceMu.RUnlock()

	n := len(pushTraceEvents)
	if limit <= 0 || limit > n {
		limit = n
	}
	start := n - limit
	out := make([]PushTraceEvent, limit)
	copy(out, pushTraceEvents[start:])
	return out
}