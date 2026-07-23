import { Router } from "express";
import {
  activityOverTime,
  listDevices,
  recentEvents,
  summaryStats,
  topApps,
} from "../services/activity.js";

export const dashboardRouter = Router();

function parseRange(query: Record<string, unknown>): { from: Date; to: Date } {
  const to = query.to ? new Date(String(query.to)) : new Date();
  const from = query.from
    ? new Date(String(query.from))
    : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw Object.assign(new Error("invalid from/to"), { status: 400 });
  }
  if (from >= to) {
    throw Object.assign(new Error("from must be before to"), { status: 400 });
  }
  return { from, to };
}

function parseDeviceId(query: Record<string, unknown>): string | undefined {
  const raw = query.deviceId;
  if (raw === undefined || raw === null || raw === "" || raw === "all") {
    return undefined;
  }
  return String(raw);
}

dashboardRouter.get("/devices", async (_req, res, next) => {
  try {
    const payload = await listDevices();
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/stats/summary", async (req, res, next) => {
  try {
    const range = parseRange(req.query as Record<string, unknown>);
    const deviceId = parseDeviceId(req.query as Record<string, unknown>);
    const summary = await summaryStats(range, { deviceId });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/stats/top-apps", async (req, res, next) => {
  try {
    const range = parseRange(req.query as Record<string, unknown>);
    const deviceId = parseDeviceId(req.query as Record<string, unknown>);
    const limit = Math.min(Number(req.query.limit ?? 10) || 10, 50);
    const apps = await topApps(range, limit, { deviceId });
    res.json({ apps, deviceId: deviceId ?? null, ...range });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/stats/activity-over-time", async (req, res, next) => {
  try {
    const range = parseRange(req.query as Record<string, unknown>);
    const deviceId = parseDeviceId(req.query as Record<string, unknown>);
    const bucket = req.query.bucket === "day" ? "day" : "hour";
    const points = await activityOverTime(range, bucket, { deviceId });
    res.json({ bucket, points, deviceId: deviceId ?? null, ...range });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/events/recent", async (req, res, next) => {
  try {
    const deviceId = parseDeviceId(req.query as Record<string, unknown>);
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    const events = await recentEvents(limit, { deviceId });
    res.json({ events, deviceId: deviceId ?? null });
  } catch (err) {
    next(err);
  }
});
