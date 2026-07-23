import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://activtrak:activtrak@localhost:5432/activtrak",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  /** Heartbeat freshness window used for device `online` (ms). */
  onlineWindowMs: Number(process.env.ONLINE_WINDOW_MS ?? 120_000),
  maxWindowTitleLength: Number(process.env.MAX_WINDOW_TITLE_LENGTH ?? 500),
  maxDurationMs: Number(process.env.MAX_DURATION_MS ?? 24 * 60 * 60 * 1000),
  /** Allow small clock skew for "future" timestamps (ms). */
  maxClockSkewMs: Number(process.env.MAX_CLOCK_SKEW_MS ?? 5 * 60 * 1000),
};
