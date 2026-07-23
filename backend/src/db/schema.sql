-- ActivTrak activity analytics schema
-- Aggregation approach: store raw events; dashboard metrics via SQL GROUP BY / date_trunc at query time.
-- Future: nightly rollup tables for long-range charts.

CREATE TABLE IF NOT EXISTS devices (
  device_id   TEXT PRIMARY KEY,
  hostname    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_events (
  id           BIGSERIAL PRIMARY KEY,
  device_id    TEXT NOT NULL REFERENCES devices(device_id),
  hostname     TEXT NOT NULL,
  app_name     TEXT NOT NULL,
  window_title TEXT NOT NULL DEFAULT '',
  is_idle      BOOLEAN NOT NULL DEFAULT FALSE,
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ NOT NULL,
  duration_ms  BIGINT NOT NULL CHECK (duration_ms >= 0),
  source       TEXT NOT NULL DEFAULT 'desktop',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_events_time_order CHECK (ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_activity_events_started_at
  ON activity_events (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_device_started
  ON activity_events (device_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_events_app_name
  ON activity_events (app_name);

CREATE INDEX IF NOT EXISTS idx_activity_events_idle_started
  ON activity_events (is_idle, started_at DESC);

CREATE TABLE IF NOT EXISTS heartbeats (
  id          BIGSERIAL PRIMARY KEY,
  device_id   TEXT NOT NULL REFERENCES devices(device_id),
  hostname    TEXT NOT NULL,
  status      TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_device_recorded
  ON heartbeats (device_id, recorded_at DESC);
