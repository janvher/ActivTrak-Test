package collector

import (
	"testing"
	"time"
)

func TestSegmentTrackerEmitsOnChange(t *testing.T) {
	tr := &SegmentTracker{DeviceID: "d1", Hostname: "host"}
	t0 := time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC)

	if ev := tr.Observe(Snapshot{AppName: "Code", WindowTitle: "a", IsIdle: false, CapturedAt: t0}); ev != nil {
		t.Fatalf("first observe should not emit, got %+v", ev)
	}

	t1 := t0.Add(5 * time.Second)
	ev := tr.Observe(Snapshot{AppName: "Safari", WindowTitle: "b", IsIdle: false, CapturedAt: t1})
	if ev == nil {
		t.Fatal("expected event on app change")
	}
	if ev.AppName != "Code" || ev.DurationMs != 5000 {
		t.Fatalf("unexpected event: %+v", ev)
	}

	flush := tr.Flush(t1.Add(2 * time.Second))
	if flush == nil || flush.AppName != "Safari" || flush.DurationMs != 2000 {
		t.Fatalf("unexpected flush: %+v", flush)
	}
}

func TestSegmentTrackerIdleChange(t *testing.T) {
	tr := &SegmentTracker{DeviceID: "d1", Hostname: "host"}
	t0 := time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC)
	_ = tr.Observe(Snapshot{AppName: "Code", IsIdle: false, CapturedAt: t0})
	ev := tr.Observe(Snapshot{AppName: "Code", IsIdle: true, CapturedAt: t0.Add(time.Minute)})
	if ev == nil || ev.IsIdle != false {
		t.Fatalf("expected active segment closed, got %+v", ev)
	}
}
