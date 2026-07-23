# ActivTrak-like Activity Analytics Platform

A technical assessment project: an ethical, transparent activity analytics platform with a **macOS desktop agent**, **Node.js/TypeScript API**, **React dashboard**, and optional **Chrome extension**.

## Architecture

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────┐     SQL      ┌────────────┐
│  Desktop Agent  │ ─────────────────► │  Backend API     │ ──────────► │ PostgreSQL │
│  (Go, macOS)    │   events +         │  (Node + TS)     │             └────────────┘
│  Visible tray   │   heartbeats       │                  │
└─────────────────┘                    └────────┬─────────┘
                                                │
┌─────────────────┐                             │ REST
│ Chrome Extension│ ────────────────────────────┤
│ (optional)      │                             ▼
└─────────────────┘                    ┌──────────────────┐
                                       │  Dashboard       │
                                       │  (React + TS)    │
                                       └──────────────────┘
```

### Why Go for the Desktop Agent?

- **Lightweight**: single static binary, low memory footprint — ideal for always-on agents
- **Native OS integration**: easy to call macOS APIs / AppleScript without a heavy runtime
- **Cross-platform potential**: same language can target Windows/Linux later
- **Simple concurrency**: goroutines for polling, heartbeats, and HTTP upload

## Components

| Component | Stack | Status |
|-----------|-------|--------|
| Desktop Agent | Go (macOS menu bar) | In progress |
| Backend API | Node.js + TypeScript + PostgreSQL | Planned |
| Dashboard | React + TypeScript | Planned |
| Chrome Extension | JavaScript (MV3) | Optional |

## Privacy Constraints (enforced by design)

- **No** keylogging, camera/mic access, file monitoring, or browser history import
- Agent has a **visible** menu bar UI; user can **Pause** and **Quit** at any time
- Collects only: foreground app, window title, active/idle state, timestamps, durations, device ID, heartbeats

## Quick Start

### Desktop Agent (macOS)

```bash
cd desktop-agent
go mod tidy
go run .
```

On first run, grant **Accessibility** permission when prompted (needed to read the frontmost app name via System Events). Use the menu bar icon to Pause / Resume / Quit.

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ACTIVTRAK_API_URL` | `http://localhost:3001` | Backend base URL |
| `ACTIVTRAK_POLL_INTERVAL` | `3s` | How often to sample activity |
| `ACTIVTRAK_IDLE_THRESHOLD` | `60s` | Idle after this much no input |
| `ACTIVTRAK_HEARTBEAT_INTERVAL` | `30s` | Heartbeat cadence |

### Backend / Dashboard

*(Setup instructions will be added as those components are built.)*

## Completed Features

- [x] Project structure
- [x] macOS Go agent: visible tray, pause/stop, activity + heartbeat collection
- [ ] Backend API + PostgreSQL
- [ ] React dashboard
- [ ] Chrome extension (optional)

## Limitations

- Agent targets **macOS only** for this assessment
- Window titles require Accessibility permission
- Backend must be running for events to persist (agent buffers failed sends in-memory briefly)

## Future Improvements

- Offline queue persisted to disk
- Windows/Linux agent builds
- Aggregations and reporting jobs
- Auth / multi-tenant accounts

## AI Usage

See [AI_USAGE.md](./AI_USAGE.md) for a full transcript of AI-assisted development.
