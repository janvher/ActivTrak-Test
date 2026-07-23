// ActivTrak desktop agent for macOS.
//
// Visible menu-bar application that samples foreground app / window title /
// idle state, derives activity durations, and sends events + heartbeats to the
// backend API. Users can Pause or Quit at any time — no stealth monitoring.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/activtrak-test/desktop-agent/internal/collector"
	"github.com/activtrak-test/desktop-agent/internal/config"
	"github.com/activtrak-test/desktop-agent/internal/device"
	"github.com/activtrak-test/desktop-agent/internal/sender"
	"github.com/activtrak-test/desktop-agent/internal/ui"
)

func main() {
	cfg := config.Load()

	deviceID, err := device.ID(cfg.DataDir)
	if err != nil {
		log.Fatalf("device id: %v", err)
	}
	hostname := device.Hostname()

	log.Printf("ActivTrak agent starting")
	log.Printf("  device:   %s (%s)", hostname, deviceID)
	log.Printf("  api:      %s", cfg.APIURL)
	log.Printf("  poll:     %s  idle≥%s  heartbeat every %s", cfg.PollInterval, cfg.IdleThreshold, cfg.HeartbeatInterval)
	log.Printf("Menu bar: look for \"AT\" — use Pause / Resume / Quit there.")
	log.Printf("Privacy: no keylogging, camera, mic, files, or browser history.")

	api := sender.New(cfg.APIURL)
	col := &collector.Collector{IdleThreshold: cfg.IdleThreshold}
	tracker := &collector.SegmentTracker{DeviceID: deviceID, Hostname: hostname}
	tray := ui.NewState()
	tray.SetDeviceLabel(fmt.Sprintf("%s · %s", hostname, shortID(deviceID)))

	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup

	flushSegment := func() {
		if ev := tracker.Flush(time.Now().UTC()); ev != nil {
			log.Printf("event: %s (%dms, idle=%v)", ev.AppName, ev.DurationMs, ev.IsIdle)
			api.Enqueue(*ev)
		}
	}

	tray.SetCallbacks(
		func() { // pause
			flushSegment()
			_ = api.SendHeartbeat(context.Background(), sender.Heartbeat{
				DeviceID:  deviceID,
				Hostname:  hostname,
				Status:    "paused",
				Timestamp: time.Now().UTC(),
			})
			log.Printf("monitoring paused by user")
		},
		func() { // resume
			_ = api.SendHeartbeat(context.Background(), sender.Heartbeat{
				DeviceID:  deviceID,
				Hostname:  hostname,
				Status:    "running",
				Timestamp: time.Now().UTC(),
			})
			log.Printf("monitoring resumed by user")
		},
		func() { // quit
			flushSegment()
			_ = api.Flush(context.Background())
			_ = api.SendHeartbeat(context.Background(), sender.Heartbeat{
				DeviceID:  deviceID,
				Hostname:  hostname,
				Status:    "stopped",
				Timestamp: time.Now().UTC(),
			})
			cancel()
		},
	)

	wg.Add(1)
	go func() {
		defer wg.Done()
		runAgent(ctx, cfg, col, tracker, api, tray, deviceID, hostname)
	}()

	// Graceful shutdown from terminal (Ctrl+C) as well as tray Quit.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		select {
		case <-sigCh:
			log.Printf("signal received — shutting down")
			flushSegment()
			_ = api.Flush(context.Background())
			cancel()
			tray.Quit()
		case <-ctx.Done():
		}
	}()

	// systray.Run must be on the main goroutine on macOS.
	tray.Run()
	cancel()
	wg.Wait()
}

func runAgent(
	ctx context.Context,
	cfg config.Config,
	col *collector.Collector,
	tracker *collector.SegmentTracker,
	api *sender.Client,
	tray *ui.State,
	deviceID, hostname string,
) {
	poll := time.NewTicker(cfg.PollInterval)
	heartbeat := time.NewTicker(cfg.HeartbeatInterval)
	flushTicker := time.NewTicker(15 * time.Second)
	defer poll.Stop()
	defer heartbeat.Stop()
	defer flushTicker.Stop()

	sendHB := func(status string) {
		err := api.SendHeartbeat(ctx, sender.Heartbeat{
			DeviceID:  deviceID,
			Hostname:  hostname,
			Status:    status,
			Timestamp: time.Now().UTC(),
		})
		if err != nil {
			log.Printf("heartbeat failed (backend up?): %v", err)
		}
	}

	sendHB("running")

	for {
		select {
		case <-ctx.Done():
			return

		case <-poll.C:
			if tray.IsPaused() {
				continue
			}
			snap, err := col.Sample()
			if err != nil {
				tray.SetStatus("Permission needed — see terminal")
				log.Printf("sample error: %v", err)
				continue
			}
			tray.SetStatus(snap.StatusLine())
			if ev := tracker.Observe(snap); ev != nil {
				log.Printf("event: %s / %q (%dms, idle=%v)", ev.AppName, truncate(ev.WindowTitle, 40), ev.DurationMs, ev.IsIdle)
				api.Enqueue(*ev)
			}

		case <-heartbeat.C:
			status := "running"
			if tray.IsPaused() {
				status = "paused"
			}
			sendHB(status)

		case <-flushTicker.C:
			if err := api.Flush(ctx); err != nil {
				log.Printf("flush failed (%d pending): %v", api.PendingCount(), err)
			}
		}
	}
}

func shortID(id string) string {
	if len(id) <= 8 {
		return id
	}
	return id[:8]
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-3] + "..."
}
