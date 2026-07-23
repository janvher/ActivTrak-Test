# AI Usage Transcript

This document records the AI-assisted development session for the ActivTrak-like activity analytics assessment.

---

## Session Start — 2026-07-23

### User Request (initial)

Build a complete ActivTrak-like activity analytics platform as a technical assessment with:

**System Architecture**
- Desktop Agent (most important)
- Backend API (Node.js + TypeScript)
- Dashboard (React + TypeScript)
- Optional Chrome Extension

**Desktop Agent Requirements**
- Build for macOS
- Written in Go (explain choice in README)
- Visible UI, easy to stop/pause — NO stealth monitoring
- Collect: foreground application, window title, active/idle state, timestamps, durations, device ID, heartbeat
- Send data to backend API

**Backend API Requirements**
- Node.js + TypeScript
- Design API shape, event model, database schema, aggregation approach
- PostgreSQL database
- Receive activity data from agent
- Expose data for dashboard

**Dashboard Requirements**
- React + TypeScript
- Show: active users/devices, last seen, total active/idle time, top applications, recent activity, activity over time
- Usable and clear (doesn't need to be beautiful)

**Privacy Constraints**
- NO keylogging, camera/mic access, file monitoring, browser history import
- User must always know agent is running and can pause it

**Implementation Order**
1. Desktop Agent (Go)
2. Backend API (Node.js + TypeScript + PostgreSQL)
3. Dashboard (React + TypeScript)
4. Chrome Extension (optional but encouraged)

**Deliverables**
- Complete Git repository with source code
- README with setup, architecture, features, limitations, improvements
- Commit as you build (not one big dump)
- Include AI_USAGE.md with full transcript of the session including this request

**Tech Stack**
- Desktop Agent: Go
- Backend: Node.js + TypeScript + PostgreSQL
- Frontend: React + TypeScript
- Optional: Chrome Extension (JavaScript)

**Immediate instructions**
- Create project structure: `/desktop-agent`, `/backend`, `/dashboard`, `/chrome-extension`, root `README.md` and `AI_USAGE.md`
- Begin with the macOS desktop agent in Go
- Create `main.go` and implement a visible application that collects required activity data and can be easily paused/stopped

### Assistant Actions (this turn)

1. Inspected empty git repository (branch `master`, no commits yet).
2. Created project directories:
   - `desktop-agent/` (with `internal/{collector,sender,config,ui,device}`)
   - `backend/`
   - `dashboard/`
   - `chrome-extension/`
3. Wrote root `README.md` covering architecture, Go rationale, privacy constraints, and setup stubs.
4. Started this `AI_USAGE.md` transcript.
5. Implemented the macOS Go desktop agent (visible menu bar UI, activity collection, pause/stop, heartbeat, API client).
6. Committed work incrementally as components were completed.

*(Further turns will be appended below as the session continues.)*

---

## Turn Log

### Turn 1 — Project structure + Desktop Agent

- **User:** Scaffold repo; build macOS Go agent first with visible pause/stop and required telemetry fields.
- **Assistant:** Created structure, README, AI_USAGE.md; implemented Go agent packages (`config`, `device`, `collector`, `sender`, `ui`) and `main.go`; committed.
