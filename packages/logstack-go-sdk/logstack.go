// Package logstack provides a Go SDK for the Logstack logging platform.
package logstack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Version is the SDK release version (matches git tag packages/logstack-go-sdk/vX.Y.Z).
const Version = "1.0.2"

const (
	defaultAPIURL        = "https://api.logstack.tech"
	defaultFlushInterval = 5 * time.Second
	defaultBatchSize     = 100
	defaultSendTimeout   = 10 * time.Second
)

// Config holds the configuration for the Logstack client.
type Config struct {
	APIKey        string
	APIURL        string
	FlushInterval time.Duration
	BatchSize     int
	Environment   string
	// OnError is called when a flush fails after the batch has been re-queued.
	OnError func(err error, logs []LogEntry)
}

// Client is the main Logstack client.
type Client struct {
	config      Config
	httpClient  *http.Client
	batch       []LogEntry
	mu          sync.Mutex
	flushTicker *time.Ticker
	done        chan struct{}
	closeOnce   sync.Once
	closed      bool
}

// LogEntry represents a single log entry.
type LogEntry struct {
	Level    string                 `json:"level"`
	Message  string                 `json:"message"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	Source   string                 `json:"source,omitempty"`
}

// NewClient creates a new Logstack client.
func NewClient(config Config) *Client {
	if config.APIURL == "" {
		config.APIURL = defaultAPIURL
	}
	config.APIURL = normalizeAPIURL(config.APIURL)
	if config.FlushInterval == 0 {
		config.FlushInterval = defaultFlushInterval
	}
	if config.BatchSize == 0 {
		config.BatchSize = defaultBatchSize
	}
	if config.Environment == "" {
		config.Environment = "production"
	}

	c := &Client{
		config:     config,
		httpClient: &http.Client{Timeout: defaultSendTimeout},
		batch:      make([]LogEntry, 0, config.BatchSize),
		done:       make(chan struct{}),
	}

	c.flushTicker = time.NewTicker(config.FlushInterval)
	go c.backgroundFlush()

	return c
}

func normalizeAPIURL(raw string) string {
	url := strings.TrimRight(raw, "/")
	url = strings.TrimSuffix(url, "/v1")
	return strings.TrimRight(url, "/")
}

func (c *Client) backgroundFlush() {
	for {
		select {
		case <-c.flushTicker.C:
			ctx, cancel := context.WithTimeout(context.Background(), defaultSendTimeout)
			_ = c.FlushContext(ctx)
			cancel()
		case <-c.done:
			c.flushTicker.Stop()
			return
		}
	}
}

// Info sends an info level log.
func (c *Client) Info(ctx context.Context, message string, metadata ...map[string]interface{}) error {
	return c.log(ctx, "info", message, metadata...)
}

// Debug sends a debug level log.
func (c *Client) Debug(ctx context.Context, message string, metadata ...map[string]interface{}) error {
	return c.log(ctx, "debug", message, metadata...)
}

// Warn sends a warn level log.
func (c *Client) Warn(ctx context.Context, message string, metadata ...map[string]interface{}) error {
	return c.log(ctx, "warn", message, metadata...)
}

// Error sends an error level log.
func (c *Client) Error(ctx context.Context, message string, metadata ...map[string]interface{}) error {
	return c.log(ctx, "error", message, metadata...)
}

// Critical sends a critical level log.
func (c *Client) Critical(ctx context.Context, message string, metadata ...map[string]interface{}) error {
	return c.log(ctx, "critical", message, metadata...)
}

// Fatal sends a fatal level log and flushes immediately.
func (c *Client) Fatal(ctx context.Context, message string, metadata ...map[string]interface{}) error {
	err := c.log(ctx, "fatal", message, metadata...)
	flushErr := c.FlushContext(ctx)
	if err != nil {
		return err
	}
	return flushErr
}

func (c *Client) log(ctx context.Context, level, message string, metadata ...map[string]interface{}) error {
	entry := LogEntry{
		Level:    level,
		Message:  message,
		Metadata: map[string]interface{}{},
		Source:   "go-sdk",
	}

	if len(metadata) > 0 && metadata[0] != nil {
		entry.Metadata = metadata[0]
	}

	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return fmt.Errorf("client is closed")
	}
	c.batch = append(c.batch, entry)
	shouldFlush := len(c.batch) >= c.config.BatchSize
	var toSend []LogEntry
	if shouldFlush {
		toSend = c.batch
		c.batch = make([]LogEntry, 0, c.config.BatchSize)
	}
	c.mu.Unlock()

	if toSend != nil {
		return c.send(ctx, toSend)
	}
	return nil
}

// Flush sends any pending logs to the server.
func (c *Client) Flush() error {
	ctx, cancel := context.WithTimeout(context.Background(), defaultSendTimeout)
	defer cancel()
	return c.FlushContext(ctx)
}

// FlushContext sends pending logs using the provided context.
func (c *Client) FlushContext(ctx context.Context) error {
	c.mu.Lock()
	if len(c.batch) == 0 || c.closed {
		c.mu.Unlock()
		return nil
	}
	toSend := c.batch
	c.batch = make([]LogEntry, 0, c.config.BatchSize)
	c.mu.Unlock()

	return c.send(ctx, toSend)
}

func (c *Client) send(ctx context.Context, batch []LogEntry) error {
	if len(batch) == 0 {
		return nil
	}

	reqBody, err := json.Marshal(map[string]interface{}{
		"logs":        batch,
		"environment": c.config.Environment,
	})
	if err != nil {
		return fmt.Errorf("marshal logs: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.APIURL+"/v1/logs", bytes.NewReader(reqBody))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		if c.config.OnError != nil {
			c.config.OnError(err, batch)
		}
		return fmt.Errorf("send logs: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		sendErr := fmt.Errorf("logstack API error (%d): %s", resp.StatusCode, body)
		if c.config.OnError != nil {
			c.config.OnError(sendErr, batch)
		}
		return sendErr
	}

	return nil
}

// Close closes the client and flushes any pending logs.
func (c *Client) Close() error {
	var err error
	c.closeOnce.Do(func() {
		c.mu.Lock()
		c.closed = true
		c.mu.Unlock()
		err = c.Flush()
		close(c.done)
	})
	return err
}