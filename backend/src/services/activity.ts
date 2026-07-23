import { config } from "../config.js";
import { query } from "../db/pool.js";
import type { ActivityEventInput, HeartbeatInput } from "../types.js";

export async function upsertDevice(
  deviceId: string,
  hostname: string,
  status: string,
  seenAt: Date,
): Promise<void> {
  await query(
    `INSERT INTO devices (device_id, hostname, status, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (device_id) DO UPDATE SET
       hostname = EXCLUDED.hostname,
       status = EXCLUDED.status,
       last_seen_at = GREATEST(COALESCE(devices.last_seen_at, EXCLUDED.last_seen_at), EXCLUDED.last_seen_at),
       updated_at = NOW()`,
    [deviceId, hostname, status, seenAt.toISOString()],
  );
}

export async function insertEvents(events: ActivityEventInput[]): Promise<number> {
  if (events.length === 0) return 0;

  const byDevice = new Map<string, ActivityEventInput>();
  for (const ev of events) {
    const prev = byDevice.get(ev.deviceId);
    if (!prev || ev.endedAt > prev.endedAt) {
      byDevice.set(ev.deviceId, ev);
    }
  }
  for (const ev of byDevice.values()) {
    await upsertDevice(ev.deviceId, ev.hostname, "running", ev.endedAt);
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 1;
  for (const ev of events) {
    placeholders.push(
      `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`,
    );
    values.push(
      ev.deviceId,
      ev.hostname,
      ev.appName,
      ev.windowTitle ?? "",
      ev.isIdle,
      ev.startedAt.toISOString(),
      ev.endedAt.toISOString(),
      ev.durationMs,
      ev.source ?? "desktop",
    );
  }

  const result = await query(
    `INSERT INTO activity_events
      (device_id, hostname, app_name, window_title, is_idle, started_at, ended_at, duration_ms, source)
     VALUES ${placeholders.join(", ")}`,
    values,
  );
  return result.rowCount ?? events.length;
}

export async function insertHeartbeat(hb: HeartbeatInput): Promise<void> {
  await upsertDevice(hb.deviceId, hb.hostname, hb.status, hb.timestamp);
  await query(
    `INSERT INTO heartbeats (device_id, hostname, status, recorded_at)
     VALUES ($1, $2, $3, $4)`,
    [hb.deviceId, hb.hostname, hb.status, hb.timestamp.toISOString()],
  );
}

export interface TimeRange {
  from: Date;
  to: Date;
}

export interface DeviceFilter {
  deviceId?: string;
}

function deviceClause(
  startParam: number,
  deviceId?: string,
): { sql: string; params: unknown[]; next: number } {
  if (!deviceId) return { sql: "", params: [], next: startParam };
  return {
    sql: ` AND device_id = $${startParam}`,
    params: [deviceId],
    next: startParam + 1,
  };
}

export function getOnlineWindowMs(): number {
  return config.onlineWindowMs;
}

export async function listDevices() {
  const { rows } = await query<{
    device_id: string;
    hostname: string;
    status: string;
    last_seen_at: Date | null;
    created_at: Date;
  }>(
    `SELECT device_id, hostname, status, last_seen_at, created_at
     FROM devices
     ORDER BY last_seen_at DESC NULLS LAST`,
  );
  const onlineWindowMs = config.onlineWindowMs;
  return {
    onlineWindowMs,
    onlineWindowSeconds: Math.round(onlineWindowMs / 1000),
    devices: rows.map((r) => ({
      deviceId: r.device_id,
      hostname: r.hostname,
      status: r.status,
      lastSeenAt: r.last_seen_at,
      createdAt: r.created_at,
      online: isOnline(r.last_seen_at, r.status, onlineWindowMs),
      presence: presenceLabel(r.last_seen_at, r.status, onlineWindowMs),
    })),
  };
}

function isOnline(
  lastSeen: Date | null,
  status: string,
  onlineWindowMs: number,
): boolean {
  if (!lastSeen || status === "stopped") return false;
  if (status === "paused") return true; // paused but recently heartbeating still "known"
  return Date.now() - new Date(lastSeen).getTime() < onlineWindowMs;
}

function presenceLabel(
  lastSeen: Date | null,
  status: string,
  onlineWindowMs: number,
): "online" | "paused" | "offline" | "stopped" {
  if (status === "stopped") return "stopped";
  if (!lastSeen) return "offline";
  const fresh = Date.now() - new Date(lastSeen).getTime() < onlineWindowMs;
  if (!fresh) return "offline";
  if (status === "paused") return "paused";
  return "online";
}

export async function summaryStats(range: TimeRange, filter: DeviceFilter = {}) {
  const d = deviceClause(3, filter.deviceId);
  const { rows } = await query<{
    total_active_ms: string;
    total_idle_ms: string;
    event_count: string;
    device_count: string;
  }>(
    `SELECT
       COALESCE(SUM(duration_ms) FILTER (WHERE NOT is_idle), 0)::text AS total_active_ms,
       COALESCE(SUM(duration_ms) FILTER (WHERE is_idle), 0)::text AS total_idle_ms,
       COUNT(*)::text AS event_count,
       COUNT(DISTINCT device_id)::text AS device_count
     FROM activity_events
     WHERE started_at >= $1 AND started_at < $2${d.sql}`,
    [range.from.toISOString(), range.to.toISOString(), ...d.params],
  );
  const row = rows[0];
  return {
    totalActiveMs: Number(row?.total_active_ms ?? 0),
    totalIdleMs: Number(row?.total_idle_ms ?? 0),
    eventCount: Number(row?.event_count ?? 0),
    deviceCount: Number(row?.device_count ?? 0),
    from: range.from,
    to: range.to,
    deviceId: filter.deviceId ?? null,
  };
}

export async function topApps(
  range: TimeRange,
  limit: number,
  filter: DeviceFilter = {},
) {
  const d = deviceClause(3, filter.deviceId);
  const limitParam = d.next;
  const { rows } = await query<{
    app_name: string;
    active_ms: string;
    idle_ms: string;
    event_count: string;
  }>(
    `SELECT
       app_name,
       COALESCE(SUM(duration_ms) FILTER (WHERE NOT is_idle), 0)::text AS active_ms,
       COALESCE(SUM(duration_ms) FILTER (WHERE is_idle), 0)::text AS idle_ms,
       COUNT(*)::text AS event_count
     FROM activity_events
     WHERE started_at >= $1 AND started_at < $2${d.sql}
     GROUP BY app_name
     ORDER BY SUM(duration_ms) FILTER (WHERE NOT is_idle) DESC NULLS LAST
     LIMIT $${limitParam}`,
    [range.from.toISOString(), range.to.toISOString(), ...d.params, limit],
  );
  return rows.map((r) => ({
    appName: r.app_name,
    activeMs: Number(r.active_ms),
    idleMs: Number(r.idle_ms),
    eventCount: Number(r.event_count),
  }));
}

export async function activityOverTime(
  range: TimeRange,
  bucket: "hour" | "day",
  filter: DeviceFilter = {},
) {
  const trunc = bucket === "day" ? "day" : "hour";
  const d = deviceClause(4, filter.deviceId);
  const { rows } = await query<{
    bucket: Date;
    active_ms: string;
    idle_ms: string;
  }>(
    `SELECT
       date_trunc($3, started_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS bucket,
       COALESCE(SUM(duration_ms) FILTER (WHERE NOT is_idle), 0)::text AS active_ms,
       COALESCE(SUM(duration_ms) FILTER (WHERE is_idle), 0)::text AS idle_ms
     FROM activity_events
     WHERE started_at >= $1 AND started_at < $2${d.sql}
     GROUP BY 1
     ORDER BY 1 ASC`,
    [range.from.toISOString(), range.to.toISOString(), trunc, ...d.params],
  );

  const points = rows.map((r) => ({
    bucket: r.bucket,
    activeMs: Number(r.active_ms),
    idleMs: Number(r.idle_ms),
  }));

  return fillEmptyBuckets(range, bucket, points);
}

/** Fill missing hour/day buckets with zeros so charts don’t show false gaps. */
export function fillEmptyBuckets(
  range: TimeRange,
  bucket: "hour" | "day",
  points: { bucket: Date; activeMs: number; idleMs: number }[],
) {
  const stepMs = bucket === "day" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const start = truncateUtc(range.from, bucket);
  const endMs = range.to.getTime();
  const map = new Map<number, { bucket: Date; activeMs: number; idleMs: number }>();
  for (const p of points) {
    map.set(truncateUtc(new Date(p.bucket), bucket).getTime(), {
      bucket: truncateUtc(new Date(p.bucket), bucket),
      activeMs: p.activeMs,
      idleMs: p.idleMs,
    });
  }

  const filled: { bucket: Date; activeMs: number; idleMs: number }[] = [];
  for (let t = start.getTime(); t < endMs; t += stepMs) {
    filled.push(map.get(t) ?? { bucket: new Date(t), activeMs: 0, idleMs: 0 });
  }
  return filled;
}

function truncateUtc(date: Date, bucket: "hour" | "day"): Date {
  const d = new Date(date);
  if (bucket === "day") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()),
  );
}

export async function recentEvents(
  limit: number,
  filter: DeviceFilter = {},
  offset = 0,
) {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (filter.deviceId) {
    params.push(filter.deviceId);
    clauses.push(`device_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  params.push(limit + 1);
  const limitPlaceholder = `$${params.length}`;
  params.push(Math.max(0, offset));
  const offsetPlaceholder = `$${params.length}`;

  const { rows } = await query<{
    id: string;
    device_id: string;
    hostname: string;
    app_name: string;
    window_title: string;
    is_idle: boolean;
    started_at: Date;
    ended_at: Date;
    duration_ms: string;
    source: string;
  }>(
    `SELECT id, device_id, hostname, app_name, window_title, is_idle,
            started_at, ended_at, duration_ms::text, source
     FROM activity_events
     ${where}
     ORDER BY ended_at DESC, id DESC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    params,
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    events: page.map((r) => ({
      id: Number(r.id),
      deviceId: r.device_id,
      hostname: r.hostname,
      appName: r.app_name,
      windowTitle: r.window_title,
      isIdle: r.is_idle,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      durationMs: Number(r.duration_ms),
      source: r.source,
    })),
    hasMore,
    limit,
    offset,
  };
}
