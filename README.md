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

API: `http://localhost:3001` — see [backend/README.md](./backend/README.md).

### 2. Desktop Agent (macOS)

```bash
cd desktop-agent
go mod tidy
go run .
```

Grant **Accessibility** to your terminal/binary (System Settings → Privacy & Security → Accessibility). Use menu bar **AT** for Pause / Resume / Quit.

| Variable | Default | Description |
|----------|---------|-------------|
| `ACTIVTRAK_API_URL` | `http://localhost:3001` | Backend base URL |
| `ACTIVTRAK_POLL_INTERVAL` | `3s` | Sample interval |
| `ACTIVTRAK_IDLE_THRESHOLD` | `60s` | Idle after no input |
| `ACTIVTRAK_HEARTBEAT_INTERVAL` | `30s` | Heartbeat cadence |

### 3. Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173

### 4. Chrome Extension (optional)

1. Open `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select `chrome-extension/`
3. Browse a few sites (stay ≥1s per domain), then check the dashboard **Source** column for `chrome`

Contract check (same payload as the extension, no browser UI required):

```bash
# backend must be running
node chrome-extension/verify-ingest.mjs
```

## Completed Features

- [x] Project structure + incremental git history
- [x] macOS Go agent: visible tray, pause/stop, app/title/idle/durations/device ID/heartbeats
- [x] Backend API + PostgreSQL (`activtrack-test-backend`): ingest, validation, devices, stats
- [x] Query-time SQL aggregation + empty-bucket timeline fill
- [x] Event ingest responses with `inserted` / `rejected` / `reasons`
- [x] Device online window (`onlineWindowSeconds`) + presence (`online` / `paused` / `offline`)
- [x] React dashboard: devices, active/idle totals, top apps (bars + table), activity chart, recent feed
- [x] Dashboard device filter, custom date range, empty/paused/API-down states
- [x] Recent activity: ~15-row scroll viewport + offset pagination
- [x] Light/dark theme toggle (dark default; sun/moon switch)
- [x] Chrome extension: active tab domain only, pause UI, `source: "chrome"`
- [x] `AI_USAGE.md` session transcript

## Limitations

- Agent is **macOS-only** for this assessment
- Window titles need Accessibility permission
- Agent queue is **in-memory** (lost if the process exits while the API is down)
- Chrome extension host permission is scoped to `localhost:3001` / `127.0.0.1:3001`
- Modern Chrome may block CLI `--load-extension`; use **Load unpacked** in `chrome://extensions`
- Query-time aggregation suits demo scale, not multi-month warehouses
- No authentication / multi-tenant isolation

## Future Improvements

- Persist agent offline queue to disk
- Windows/Linux agent builds
- Rollup / materialized reporting tables
- Auth and multi-tenant accounts
- Configurable extension API host beyond localhost
- Server-side search filters for recent activity

## AI Usage

See [AI_USAGE.md](./AI_USAGE.md) for the full AI-assisted development transcript.
