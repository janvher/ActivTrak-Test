package collector

import (
	"bytes"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// Snapshot is a point-in-time sample of user activity on macOS.
type Snapshot struct {
	AppName     string
	WindowTitle string
	IsIdle      bool
	IdleFor     time.Duration
	CapturedAt  time.Time
}

// ActivityEvent is a closed interval of continuous activity in one app/window/idle state.
type ActivityEvent struct {
	DeviceID    string    `json:"deviceId"`
	Hostname    string    `json:"hostname"`
	AppName     string    `json:"appName"`
	WindowTitle string    `json:"windowTitle"`
	IsIdle      bool      `json:"isIdle"`
	StartedAt   time.Time `json:"startedAt"`
	EndedAt     time.Time `json:"endedAt"`
	DurationMs  int64     `json:"durationMs"`
}

// Collector samples foreground app, window title, and idle state on macOS.
type Collector struct {
	IdleThreshold time.Duration
}

// Sample reads the current frontmost application and idle time.
// Uses AppleScript (System Events) and IOHIDSystem idle time — no keylogging.
func (c *Collector) Sample() (Snapshot, error) {
	appName, title, err := frontmostApp()
	if err != nil {
		return Snapshot{}, err
	}

	idleFor, err := idleDuration()
	if err != nil {
		// Idle probe failure should not block app sampling.
		idleFor = 0
	}

	now := time.Now().UTC()
	return Snapshot{
		AppName:     appName,
		WindowTitle: title,
		IsIdle:      idleFor >= c.IdleThreshold,
		IdleFor:     idleFor,
		CapturedAt:  now,
	}, nil
}

func frontmostApp() (appName, windowTitle string, err error) {
	script := `
tell application "System Events"
	set frontApp to first application process whose frontmost is true
	set appName to name of frontApp
	set windowTitle to ""
	try
		tell frontApp
			if (count of windows) > 0 then
				set windowTitle to name of window 1
			end if
		end tell
	end try
	return appName & "|||" & windowTitle
end tell
`
	out, err := runOsascript(script)
	if err != nil {
		return "", "", fmt.Errorf("frontmost app: %w (grant Accessibility permission in System Settings)", err)
	}

	parts := strings.SplitN(strings.TrimSpace(out), "|||", 2)
	appName = parts[0]
	if len(parts) > 1 {
		windowTitle = parts[1]
	}
	return appName, windowTitle, nil
}

func idleDuration() (time.Duration, error) {
	// HIDIdleTime is nanoseconds since last user input (keyboard/mouse).
	cmd := exec.Command("ioreg", "-c", "IOHIDSystem")
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	if err := cmd.Run(); err != nil {
		return 0, err
	}

	for _, line := range strings.Split(stdout.String(), "\n") {
		if !strings.Contains(line, "HIDIdleTime") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		raw := strings.TrimSuffix(fields[len(fields)-1], ",")
		ns, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return 0, err
		}
		return time.Duration(ns), nil
	}
	return 0, fmt.Errorf("HIDIdleTime not found")
}

func runOsascript(script string) (string, error) {
	cmd := exec.Command("osascript", "-e", script)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("%s", msg)
	}
	return stdout.String(), nil
}

// SegmentTracker turns successive snapshots into closed ActivityEvents.
type SegmentTracker struct {
	DeviceID string
	Hostname string

	current *openSegment
}

type openSegment struct {
	AppName     string
	WindowTitle string
	IsIdle      bool
	StartedAt   time.Time
}

// Observe updates the open segment. If the activity key changed, it returns
// the completed event for the previous segment (may be nil on first sample).
func (t *SegmentTracker) Observe(s Snapshot) *ActivityEvent {
	keyApp, keyTitle, keyIdle := s.AppName, s.WindowTitle, s.IsIdle

	if t.current == nil {
		t.current = &openSegment{
			AppName:     keyApp,
			WindowTitle: keyTitle,
			IsIdle:      keyIdle,
			StartedAt:   s.CapturedAt,
		}
		return nil
	}

	same := t.current.AppName == keyApp &&
		t.current.WindowTitle == keyTitle &&
		t.current.IsIdle == keyIdle

	if same {
		return nil
	}

	ev := t.closeAt(s.CapturedAt)
	t.current = &openSegment{
		AppName:     keyApp,
		WindowTitle: keyTitle,
		IsIdle:      keyIdle,
		StartedAt:   s.CapturedAt,
	}
	return ev
}

// Flush closes the current segment at now (e.g. on pause or shutdown).
func (t *SegmentTracker) Flush(now time.Time) *ActivityEvent {
	if t.current == nil {
		return nil
	}
	ev := t.closeAt(now)
	t.current = nil
	return ev
}

func (t *SegmentTracker) closeAt(endedAt time.Time) *ActivityEvent {
	if t.current == nil {
		return nil
	}
	started := t.current.StartedAt
	if !endedAt.After(started) {
		endedAt = started.Add(time.Millisecond)
	}
	return &ActivityEvent{
		DeviceID:    t.DeviceID,
		Hostname:    t.Hostname,
		AppName:     t.current.AppName,
		WindowTitle: t.current.WindowTitle,
		IsIdle:      t.current.IsIdle,
		StartedAt:   started,
		EndedAt:     endedAt,
		DurationMs:  endedAt.Sub(started).Milliseconds(),
	}
}

// StatusLine returns a short human-readable description for the tray menu.
func (s Snapshot) StatusLine() string {
	state := "Active"
	if s.IsIdle {
		state = "Idle"
	}
	title := s.WindowTitle
	if title == "" {
		title = "(no window)"
	}
	if len(title) > 40 {
		title = title[:37] + "..."
	}
	return fmt.Sprintf("%s · %s — %s", state, s.AppName, title)
}
