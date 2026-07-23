import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { eventsRouter } from "./routes/events.js";
import { heartbeatsRouter } from "./routes/heartbeats.js";
import { dashboardRouter } from "./routes/dashboard.js";

async function main() {
  await migrate();

  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      service: "activtrak-backend",
      message: "API only — use /api/v1/* (dashboard UI comes next)",
      health: "/api/v1/health",
      docs: "See backend/README.md",
    });
  });

  app.get("/api/v1/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, service: "activtrak-backend", db: "up" });
    } catch {
      res.status(503).json({ ok: false, service: "activtrak-backend", db: "down" });
    }
  });

  app.use("/api/v1/events", eventsRouter);
  app.use("/api/v1/heartbeats", heartbeatsRouter);
  app.use("/api/v1", dashboardRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        typeof err === "object" && err && "status" in err
          ? Number((err as { status: number }).status)
          : 500;
      const message = err instanceof Error ? err.message : "internal error";
      console.error(err);
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    },
  );

  app.listen(config.port, () => {
    console.log(`ActivTrak API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
