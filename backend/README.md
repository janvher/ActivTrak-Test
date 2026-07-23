# Backend API

Node.js + TypeScript API that receives agent activity data and serves dashboard aggregates over PostgreSQL.

## Design

### Event model

Matches the desktop agent payloads:

- **Activity event** — closed interval: device, hostname, app, window title, idle flag, start/end, duration
- **Heartbeat** — device liveness + `running` | `paused` | `stopped`

### Database schema

| Table | Purpose |
|-------|---------|
| `devices` | One row per agent device; status + `last_seen_at` |
| `activity_events` | Raw activity segments (source of truth) |
| `heartbeats` | Heartbeat history (optional audit / debugging) |

See `src/db/schema.sql`.

### Aggregation approach

- **Write path:** append-only raw events (no pre-aggregation on ingest).
- **Read path:** SQL aggregates at query time (`SUM`, `FILTER`, `date_trunc`, `GROUP BY`) for summary, top apps, and activity-over-time charts.
- **Why:** simple, correct for assessment scale; easy to reason about.
- **Later:** rollup tables / materialized views for multi-month dashboards.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Liveness + DB check |
| `POST` | `/api/v1/events` | Batch ingest from agent |
| `POST` | `/api/v1/heartbeats` | Agent heartbeat |
| `GET` | `/api/v1/devices` | Devices, last seen, online |
| `GET` | `/api/v1/stats/summary` | Active/idle totals |
| `GET` | `/api/v1/stats/top-apps` | Top applications by active time |
| `GET` | `/api/v1/stats/activity-over-time` | Time series (`bucket=hour\|day`) |
| `GET` | `/api/v1/events/recent` | Recent activity feed |

Query params for stats: `from`, `to` (ISO timestamps; default last 24h).

## Setup

### 1. Start PostgreSQL

```bash
cd backend
docker compose up -d   # starts container activtrack-test-backend
```

### 2. Install & configure

```bash
cp .env.example .env
npm install
```

### 3. Run API

```bash
npm run dev
```

Listens on `http://localhost:3001`. Schema migrates automatically on startup.

### 4. Smoke test

```bash
curl -s http://localhost:3001/api/v1/health
```

With the desktop agent running (`go run .` in `desktop-agent`), pending events should flush successfully.

Optional env:

| Variable | Default | Meaning |
|----------|---------|---------|
| `ONLINE_WINDOW_MS` | `120000` | Device considered fresh/online |
| `MAX_WINDOW_TITLE_LENGTH` | `500` | Truncate window titles |
| `MAX_DURATION_MS` | `86400000` | Reject longer segments |
| `MAX_CLOCK_SKEW_MS` | `300000` | Reject far-future timestamps |

Stats endpoints accept optional `deviceId`. Activity-over-time zero-fills empty buckets. Event ingest returns `inserted` / `rejected` / `reasons`.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode via `tsx` |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run migrate` | Apply schema only |
| `npm test` | Unit tests |
