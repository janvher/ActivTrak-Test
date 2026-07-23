import { Router } from "express";
import { heartbeatSchema } from "../types.js";
import { insertHeartbeat } from "../services/activity.js";

export const heartbeatsRouter = Router();

heartbeatsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = heartbeatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
      return;
    }
    await insertHeartbeat(parsed.data);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
