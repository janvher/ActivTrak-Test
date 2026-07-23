import { Router } from "express";
import { eventsBatchSchema } from "../types.js";
import { insertEvents } from "../services/activity.js";

export const eventsRouter = Router();

eventsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = eventsBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
      return;
    }
    const inserted = await insertEvents(parsed.data.events);
    res.status(201).json({ ok: true, inserted });
  } catch (err) {
    next(err);
  }
});
