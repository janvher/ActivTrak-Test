package ui

import (
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/getlantern/systray"
)

// State is shared between the tray UI and the agent loop.
type State struct {
	paused atomic.Bool

	mu          sync.Mutex
	statusText  string
	deviceLabel string
	onPause     func()
	onResume    func()
	onQuit      func()

	mStatus *systray.MenuItem
	mPause  *systray.MenuItem
	mResume *systray.MenuItem
}

// NewState creates UI state. Call Run to start the menu bar app (blocks).
func NewState() *State {
	s := &State{}
	s.statusText = "Starting…"
	return s
}

// IsPaused reports whether collection is paused.
func (s *State) IsPaused() bool {
	return s.paused.Load()
}

// SetCallbacks registers pause/resume/quit handlers (called from tray clicks).
func (s *State) SetCallbacks(onPause, onResume, onQuit func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onPause = onPause
	s.onResume = onResume
	s.onQuit = onQuit
}

// SetDeviceLabel shows the device id / hostname in the menu.
func (s *State) SetDeviceLabel(label string) {
	s.mu.Lock()
	s.deviceLabel = label
	s.mu.Unlock()
}

// SetStatus updates the status menu item text (safe from other goroutines).
func (s *State) SetStatus(text string) {
	s.mu.Lock()
	s.statusText = text
	item := s.mStatus
	s.mu.Unlock()
	if item != nil {
		item.SetTitle(text)
	}
}

// Run starts the system tray (must run on the main thread on macOS). Blocks until Quit.
func (s *State) Run() {
	systray.Run(s.onReady, s.onExit)
}

// Quit requests the tray application to exit.
func (s *State) Quit() {
	systray.Quit()
}

func (s *State) onReady() {
	systray.SetTitle("AT")
	systray.SetTooltip("ActivTrak Agent — activity monitoring (visible, pausable)")
	systray.SetTemplateIcon(trayIcon, trayIcon)

	s.mu.Lock()
	device := s.deviceLabel
	status := s.statusText
	s.mu.Unlock()

	mTitle := systray.AddMenuItem("ActivTrak Agent", "Transparent activity agent")
	mTitle.Disable()

	if device != "" {
		mDevice := systray.AddMenuItem(device, "This device")
		mDevice.Disable()
	}

	systray.AddSeparator()

	s.mStatus = systray.AddMenuItem(status, "Current activity")
	s.mStatus.Disable()

	systray.AddSeparator()

	s.mPause = systray.AddMenuItem("Pause monitoring", "Stop collecting until resumed")
	s.mResume = systray.AddMenuItem("Resume monitoring", "Continue collecting activity")
	s.mResume.Disable()

	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Stop the agent and exit")

	go s.handleClicks(mQuit)
}

func (s *State) handleClicks(mQuit *systray.MenuItem) {
	for {
		select {
		case <-s.mPause.ClickedCh:
			s.paused.Store(true)
			s.mPause.Disable()
			s.mResume.Enable()
			systray.SetTitle("AT⏸")
			s.SetStatus("Paused — not collecting")
			s.mu.Lock()
			cb := s.onPause
			s.mu.Unlock()
			if cb != nil {
				cb()
			}

		case <-s.mResume.ClickedCh:
			s.paused.Store(false)
			s.mResume.Disable()
			s.mPause.Enable()
			systray.SetTitle("AT")
			s.SetStatus("Resumed — collecting…")
			s.mu.Lock()
			cb := s.onResume
			s.mu.Unlock()
			if cb != nil {
				cb()
			}

		case <-mQuit.ClickedCh:
			s.mu.Lock()
			cb := s.onQuit
			s.mu.Unlock()
			if cb != nil {
				cb()
			}
			systray.Quit()
			return
		}
	}
}

func (s *State) onExit() {
	fmt.Println("ActivTrak agent stopped.")
}
