# Desktop Agent (macOS)

Visible, pausable activity agent written in **Go**. Appears in the macOS menu bar as **AT**.

## What it collects

| Field | Source |
|-------|--------|
| Foreground application | AppleScript / System Events |
| Window title | AppleScript / System Events |
| Active vs idle | `IOHIDSystem` HIDIdleTime |
| Timestamps & durations | Segment tracker (state-change intervals) |
| Device ID | UUID stored in `~/.activtrak-agent/device_id` |
| Heartbeat | Periodic POST with `running` / `paused` / `stopped` |

## What it does **not** collect

No keylogging, camera, microphone, filesystem watching, or browser history.

## Run

```bash
cd desktop-agent
go mod tidy
go run .
```

Or build a binary:

```bash
go build -o activtrak-agent .
./activtrak-agent
```

### Accessibility permission

macOS requires **Accessibility** access so System Events can read the frontmost app:

1. Start the agent once (you may see sample errors in the terminal).
2. Open **System Settings → Privacy & Security → Accessibility**.
3. Enable your terminal app (or `activtrak-agent` if launched as a binary).
4. Restart the agent.

### Menu bar controls

- **Pause monitoring** — stops sampling; flushes the open segment; heartbeats report `paused`
- **Resume monitoring** — continues sampling
- **Quit** — flushes, sends `stopped` heartbeat, exits

## Configuration

| Env var | Default |
|---------|---------|
| `ACTIVTRAK_API_URL` | `http://localhost:3001` |
| `ACTIVTRAK_POLL_INTERVAL` | `3s` |
| `ACTIVTRAK_IDLE_THRESHOLD` | `60s` |
| `ACTIVTRAK_HEARTBEAT_INTERVAL` | `30s` |
| `ACTIVTRAK_DATA_DIR` | `~/.activtrak-agent` |

## API payloads (agent → backend)

`POST /api/v1/events`

```json
{
  "events": [
    {
      "deviceId": "…",
      "hostname": "MacBook",
      "appName": "Code",
      "windowTitle": "main.go",
      "isIdle": false,
      "startedAt": "2026-07-23T05:00:00Z",
      "endedAt": "2026-07-23T05:01:12Z",
      "durationMs": 72000
    }
  ]
}
```

`POST /api/v1/heartbeats`

```json
{
  "deviceId": "…",
  "hostname": "MacBook",
  "status": "running",
  "timestamp": "2026-07-23T05:01:00Z"
}
```

Events are queued in memory if the backend is down and retried on the next flush.
