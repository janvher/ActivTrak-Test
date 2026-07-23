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
  return { from, to };
}

dashboardRouter.get("/devices", async (_req, res, next) => {
  try {
    const devices = await listDevices();
    res.json({ devices });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/stats/summary", async (req, res, next) => {
  try {
    const range = parseRange(req.query as Record<string, unknown>);
    const summary = await summaryStats(range);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/stats/top-apps", async (req, res, next) => {
  try {
    const range = parseRange(req.query as Record<string, unknown>);
    const limit = Math.min(Number(req.query.limit ?? 10) || 10, 50);
    const apps = await topApps(range, limit);
    res.json({ apps, ...range });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/stats/activity-over-time", async (req, res, next) => {
  try {
    const range = parseRange(req.query as Record<string, unknown>);
    const bucket = req.query.bucket === "day" ? "day" : "hour";
    const points = await activityOverTime(range, bucket);
    res.json({ bucket, points, ...range });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/events/recent", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
    const events = await recentEvents(limit);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});
