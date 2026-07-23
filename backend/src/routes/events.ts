import { Router } from "express";
import { insertEvents } from "../services/activity.js";
import { eventsBatchSchema, parseActivityEvents } from "../types.js";

export const eventsRouter = Router();

eventsRouter.post("/", async (req, res, next) => {
  try {
    const batch = eventsBatchSchema.safeParse(req.body);
    if (!batch.success) {
      res.status(400).json({
        ok: false,
        error: "invalid payload",
        inserted: 0,
        rejected: Array.isArray(req.body?.events) ? req.body.events.length : 0,
        details: batch.error.flatten(),
      });
      return;
    }

    const { accepted, rejected } = parseActivityEvents(batch.data.events);
    if (accepted.length === 0) {
      res.status(400).json({
        ok: false,
        error: "all events rejected",
        inserted: 0,
        rejected: rejected.length,
        reasons: rejected,
      });
      return;
    }

    const inserted = await insertEvents(accepted);
    res.status(rejected.length ? 207 : 201).json({
      ok: true,
      inserted,
      rejected: rejected.length,
      reasons: rejected.length ? rejected : undefined,
    });
  } catch (err) {
    next(err);
  }
});
