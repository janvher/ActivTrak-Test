# ActivTrak-like Activity Analytics Platform

A technical assessment project: an ethical, transparent activity analytics platform with a **macOS desktop agent**, **Node.js/TypeScript API**, **React dashboard**, and optional **Chrome extension**.

## Architecture

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────┐     SQL      ┌────────────┐
│  Desktop Agent  │ ─────────────────► │  Backend API     │ ──────────► │ PostgreSQL │
│  (Go, macOS)    │   events +         │  (Node + TS)     │             │ container: │
│  Visible tray   │   heartbeats       │  :3001           │             │ activtrack │
└─────────────────┘                    └────────┬─────────┘             │ -test-     │
                                                │                       │ backend    │
┌─────────────────┐                             │ REST                  └────────────┘
│ Chrome Extension│ ────────────────────────────┤
│ (optional, MV3) │                             ▼
└─────────────────┘                    ┌──────────────────┐
                                       │  Dashboard       │
                                       │  (React + TS)    │
                                       │  :5173           │
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
| Desktop Agent | Go (macOS menu bar) | Done |
| Backend API | Node.js + TypeScript + PostgreSQL | Done |
| Dashboard | React + TypeScript (Vite) | Done |
| Chrome Extension | JavaScript (MV3) | Done (optional) |

## Privacy Constraints (enforced by design)

- **No** keylogging, camera/mic access, file monitoring, or browser history import
- Agent has a **visible** menu bar UI; user can **Pause** and **Quit** at any time
- Extension tracks **active tab domain only** with Pause in the popup
- Collects only: foreground app, window title, active/idle state, timestamps, durations, device ID, heartbeats

## Quick Start

### 1. PostgreSQL + Backend API

```bash
cd backend
docker compose up -d   # container/project: activtrack-test-backend
cp .env.example .env   # if needed
npm install
npm run dev
```

API: `http://localhost:3001` — see [backend/README.md](./backend/README.md) for schema, aggregation design, and endpoints.

### 2. Desktop Agent (macOS)

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

### 3. Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173 — see [dashboard/README.md](./dashboard/README.md).

### 4. Chrome Extension (optional)

Load unpacked from `chrome-extension/` in `chrome://extensions` (Developer mode). See [chrome-extension/README.md](./chrome-extension/README.md).

## Completed Features

- [x] Project structure
- [x] macOS Go agent: visible tray, pause/stop, activity + heartbeat collection
- [x] Backend API + PostgreSQL (ingest + dashboard query endpoints)
- [x] React dashboard (devices, active/idle totals, top apps, timeline, recent activity)
- [x] Chrome extension (active tab domain only)

## Limitations

- Agent targets **macOS only** for this assessment
- Window titles require Accessibility permission
- Backend must be running for events to persist (agent buffers failed sends in-memory briefly)
- Chrome extension host permission is scoped to local API (`localhost:3001`)
- Query-time SQL aggregation is fine for demo scale; not optimized for multi-month warehouses

## Future Improvements

- Offline queue persisted to disk
- Windows/Linux agent builds
- Rollup tables / reporting jobs
- Auth / multi-tenant accounts
- Configurable extension API host beyond localhost

## AI Usage

See [AI_USAGE.md](./AI_USAGE.md) for a full transcript of AI-assisted development.
