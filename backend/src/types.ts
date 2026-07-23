import { z } from "zod";

export const activityEventSchema = z.object({
  deviceId: z.string().min(1),
  hostname: z.string().min(1),
  appName: z.string().min(1),
  windowTitle: z.string().default(""),
  isIdle: z.boolean(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  durationMs: z.number().int().nonnegative(),
  source: z.enum(["desktop", "chrome"]).optional().default("desktop"),
});

export const eventsBatchSchema = z.object({
  events: z.array(activityEventSchema).min(1).max(500),
});

export const heartbeatSchema = z.object({
  deviceId: z.string().min(1),
  hostname: z.string().min(1),
  status: z.enum(["running", "paused", "stopped"]),
  timestamp: z.coerce.date(),
});

export type ActivityEventInput = z.infer<typeof activityEventSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
