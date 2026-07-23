# Dashboard

React + TypeScript activity analytics UI for the ActivTrak assessment.

## Features

- Online / total devices with last seen
- Total active and idle time
- Top applications
- Activity over time chart
- Recent activity feed
- Auto-refresh every 15s

## Run

Start PostgreSQL + API first (`backend`), then:

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173

Vite proxies `/api` → `http://localhost:3001`.

Optional: set `VITE_API_URL` to point at another API host (no trailing slash).
