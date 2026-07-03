package logstack

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestVersion(t *testing.T) {
	if Version != "1.0.3" {
		t.Fatalf("Version = %q, want 1.0.3", Version)
	}
}

func TestNormalizeAPIURL(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"https://api.logstack.tech", "https://api.logstack.tech"},
		{"https://api.logstack.tech/", "https://api.logstack.tech"},
		{"https://api.logstack.tech/v1", "https://api.logstack.tech"},
		{"http://localhost:8080/v1/", "http://localhost:8080"},
	}
	for _, tc := range tests {
		if got := normalizeAPIURL(tc.in); got != tc.want {
			t.Fatalf("normalizeAPIURL(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestCloseIsIdempotent(t *testing.T) {
	c := NewClient(Config{APIKey: "test-key"})
	if err := c.Close(); err != nil {
		t.Fatalf("first close: %v", err)
	}
	if err := c.Close(); err != nil {
		t.Fatalf("second close: %v", err)
	}
}

func TestCaptureStdLogForwardsWithSourceGoLog(t *testing.T) {
	var received []LogEntry
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Logs []LogEntry `json:"logs"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		received = body.Logs
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	c := NewClient(Config{
		APIKey:    "test-key",
		APIURL:    srv.URL,
		BatchSize: 100,
	})

	log.Printf("hello from stdlib log")

	if err := c.Flush(); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if err := c.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	if len(received) != 1 {
		t.Fatalf("expected 1 captured log, got %d", len(received))
	}
	if received[0].Source != "go-log" {
		t.Fatalf("source = %q, want go-log", received[0].Source)
	}
	if !strings.Contains(received[0].Message, "hello from stdlib log") {
		t.Fatalf("message = %q, want hello from stdlib log", received[0].Message)
	}
	if received[0].Level != "info" {
		t.Fatalf("level = %q, want info", received[0].Level)
	}
}

func TestCaptureStdLogRestoresOnClose(t *testing.T) {
	buf := &bytes.Buffer{}
	log.SetOutput(buf)
	defer log.SetOutput(os.Stderr)

	c := NewClient(Config{APIKey: "test-key", BatchSize: 100})
	if log.Writer() == buf {
		t.Fatal("expected stdlib log output to be redirected while capture is active")
	}

	if err := c.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	if log.Writer() != buf {
		t.Fatal("expected stdlib log output to be restored after close")
	}
}

func TestCaptureStdLogDisabled(t *testing.T) {
	orig := log.Writer()
	defer log.SetOutput(orig)

	received := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received++
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	c := NewClient(Config{
		APIKey:        "test-key",
		APIURL:        srv.URL,
		BatchSize:     100,
		CaptureStdLog: Bool(false),
	})

	if c.stdLogCaptureInstalled {
		t.Fatal("capture should not be installed when CaptureStdLog is false")
	}

	log.Printf("should not be captured")
	if err := c.Flush(); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if err := c.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	if received != 0 {
		t.Fatalf("expected no captured logs, got %d HTTP requests", received)
	}
}