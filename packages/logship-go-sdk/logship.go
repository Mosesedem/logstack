// Package logstack provides a Go SDK for the Logstack logging platform.
package logstack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

const (
defaultAPIURL = "https://api.logstack.tech"
defaultFlushInterval = 5 * time.Second
defaultBatchSize = 100
)

// Config holds the configuration for the Logstack client.
type Config struct {
	APIKey    string
	APIURL    string
	FlushInterval time.Duration
	BatchSize   int
	Environment string
}

// Client is the main Logstack client.
type Client struct {
	config      Config
	httpClient  *http.Client
	batch       []LogEntry
	mu          sync.Mutex
	flushTicker *time.Ticker
	done        chan struct{}
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
		httpClient: &http.Client{Timeout: 10 * time.Second},
		batch:      make([]LogEntry, 0, config.BatchSize),
		done:       make(chan struct{}),
	}

	// Start background flusher
	c.flushTicker = time.NewTicker(config.FlushInterval)
	go c.backgroundFlush()

	return c
}

// backgroundFlush periodically flushes the batch.
func (c *Client) backgroundFlush() {
	for {
		select {
		case <-c.flushTicker.C:
			c.Flush()
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
	c.Flush()
	return err
}

// log adds a log entry to the batch.
func (c *Client) log(ctx context.Context, level, message string, metadata ...map[string]interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := LogEntry{
		Level:    level,
		Message:  message,
		Metadata: map[string]interface{}{},
		Source:   "go-sdk",
	}

	if len(metadata) > 0 && metadata[0] != nil {
		entry.Metadata = metadata[0]
	}

	c.batch = append(c.batch, entry)

	if len(c.batch) >= c.config.BatchSize {
		return c.flushBatch(ctx)
	}

	return nil
}

// Flush sends any pending logs to the server.
func (c *Client) Flush() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if len(c.batch) == 0 {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return c.flushBatch(ctx)
}

// flushBatch sends the batch to the server.
func (c *Client) flushBatch(ctx context.Context) error {
	if len(c.batch) == 0 {
		return nil
	}

	// Create a copy of the batch
	batch := make([]LogEntry, len(c.batch))
	copy(batch, c.batch)
	c.batch = c.batch[:0]

	reqBody, err := json.Marshal(map[string]interface{}{
"logs":       batch,
"environment": c.config.Environment,
})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.config.APIURL+"/v1/logs/batch", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("logstack API error: %s", body)
	}

	return nil
}

// Close closes the client and flushes any pending logs.
func (c *Client) Close() error {
	c.Flush()
	close(c.done)
	return nil
}
