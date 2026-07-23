package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/activtrak-test/desktop-agent/internal/collector"
)

// Heartbeat reports that the agent is alive and whether it is collecting.
type Heartbeat struct {
	DeviceID  string    `json:"deviceId"`
	Hostname  string    `json:"hostname"`
	Status    string    `json:"status"` // "running" | "paused"
	Timestamp time.Time `json:"timestamp"`
}

// Client posts activity events and heartbeats to the backend API.
type Client struct {
	BaseURL    string
	HTTPClient *http.Client

	mu      sync.Mutex
	pending []collector.ActivityEvent
}

// New creates an API client with a modest timeout.
func New(baseURL string) *Client {
	return &Client{
		BaseURL: stringsTrimRightSlash(baseURL),
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func stringsTrimRightSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}

// Enqueue stores an event for delivery (and attempts an immediate flush).
func (c *Client) Enqueue(ev collector.ActivityEvent) {
	c.mu.Lock()
	c.pending = append(c.pending, ev)
	c.mu.Unlock()
	_ = c.Flush(context.Background())
}

// Flush sends all pending events as a batch. Failed sends keep events queued.
func (c *Client) Flush(ctx context.Context) error {
	c.mu.Lock()
	if len(c.pending) == 0 {
		c.mu.Unlock()
		return nil
	}
	batch := make([]collector.ActivityEvent, len(c.pending))
	copy(batch, c.pending)
	c.mu.Unlock()

	body, err := json.Marshal(map[string]any{"events": batch})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/v1/events", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "activtrak-desktop-agent/0.1")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("send events: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("send events: unexpected status %s", resp.Status)
	}

	c.mu.Lock()
	// Drop only the events we successfully sent (simple approach: clear matching prefix).
	if len(c.pending) >= len(batch) {
		c.pending = c.pending[len(batch):]
	} else {
		c.pending = nil
	}
	c.mu.Unlock()
	return nil
}

// PendingCount returns how many events are waiting to send.
func (c *Client) PendingCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.pending)
}

// SendHeartbeat posts an agent liveness / pause status update.
func (c *Client) SendHeartbeat(ctx context.Context, hb Heartbeat) error {
	body, err := json.Marshal(hb)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/v1/heartbeats", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "activtrak-desktop-agent/0.1")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("send heartbeat: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("send heartbeat: unexpected status %s", resp.Status)
	}
	return nil
}
