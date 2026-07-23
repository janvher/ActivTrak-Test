import { z } from "zod";
import { config } from "./config.js";

export const activityEventSchema = z
  .object({
    deviceId: z.string().min(1).max(128),
    hostname: z.string().min(1).max(255),
    appName: z.string().min(1).max(255),
    windowTitle: z
      .string()
      .default("")
      .transform((s) => s.slice(0, config.maxWindowTitleLength)),
    isIdle: z.boolean(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    durationMs: z.number().int().nonnegative().max(config.maxDurationMs),
    source: z.enum(["desktop", "chrome"]).optional().default("desktop"),
  })
  .superRefine((ev, ctx) => {
    if (ev.endedAt < ev.startedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endedAt must be >= startedAt",
        path: ["endedAt"],
      });
    }
    const span = ev.endedAt.getTime() - ev.startedAt.getTime();
    if (Math.abs(span - ev.durationMs) > 2000 && span >= 0) {
      // Allow 2s drift between reported duration and timestamps.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "durationMs does not match startedAt/endedAt",
        path: ["durationMs"],
      });
    }
    const now = Date.now();
    if (ev.startedAt.getTime() > now + config.maxClockSkewMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startedAt is too far in the future",
        path: ["startedAt"],
      });
    }
    if (ev.endedAt.getTime() > now + config.maxClockSkewMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endedAt is too far in the future",
        path: ["endedAt"],
      });
    }
    if (span > config.maxDurationMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `segment longer than maxDurationMs (${config.maxDurationMs})`,
        path: ["durationMs"],
      });
    }
  });

export const eventsBatchSchema = z.object({
  events: z.array(z.unknown()).min(1).max(500),
});

export const heartbeatSchema = z.object({
  deviceId: z.string().min(1).max(128),
  hostname: z.string().min(1).max(255),
  status: z.enum(["running", "paused", "stopped"]),
  timestamp: z.coerce.date(),
});

export type ActivityEventInput = z.infer<typeof activityEventSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

export interface RejectedEvent {
  index: number;
  reason: string;
}

export function parseActivityEvents(rawEvents: unknown[]): {
  accepted: ActivityEventInput[];
  rejected: RejectedEvent[];
} {
  const accepted: ActivityEventInput[] = [];
  const rejected: RejectedEvent[] = [];
  const seen = new Set<string>();

  rawEvents.forEach((raw, index) => {
    const parsed = activityEventSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({
        index,
        reason: parsed.error.issues.map((i) => i.message).join("; "),
      });
      return;
    }
    const ev = {
      ...parsed.data,
      windowTitle: parsed.data.windowTitle.slice(0, config.maxWindowTitleLength),
    };
    const key = [
      ev.deviceId,
      ev.appName,
      ev.windowTitle,
      ev.startedAt.toISOString(),
      ev.endedAt.toISOString(),
      ev.isIdle,
    ].join("|");
    if (seen.has(key)) {
      rejected.push({ index, reason: "duplicate event in batch" });
      return;
    }
    seen.add(key);
    accepted.push(ev);
  });

  return { accepted, rejected };
}
