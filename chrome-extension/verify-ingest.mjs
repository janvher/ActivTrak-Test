#!/usr/bin/env node
/**
 * Contract verification for the Chrome extension ingest path.
 * Sends the same payload shape as chrome-extension/background.js and
 * asserts the API stores source:"chrome" events visible to the dashboard.
 *
 * Usage: node chrome-extension/verify-ingest.mjs
 * Requires backend at http://localhost:3001
 */
const API = process.env.ACTIVTRAK_API_URL || "http://localhost:3001";

async function main() {
  const deviceId = crypto.randomUUID();
  const now = new Date();
  const started = new Date(now.getTime() - 5500);
  const event = {
    deviceId,
    hostname: `chrome:${deviceId.slice(0, 8)}`,
    appName: "Google Chrome",
    windowTitle: "example.com",
    isIdle: false,
    startedAt: started.toISOString(),
    endedAt: now.toISOString(),
    durationMs: 5500,
    source: "chrome",
  };

  const hb = await fetch(`${API}/api/v1/heartbeats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId,
      hostname: event.hostname,
      status: "running",
      timestamp: now.toISOString(),
    }),
  });
  if (!hb.ok) throw new Error(`heartbeat failed: ${hb.status} ${await hb.text()}`);

  const post = await fetch(`${API}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: [event] }),
  });
  const postBody = await post.json();
  if (!post.ok) throw new Error(`events failed: ${post.status} ${JSON.stringify(postBody)}`);

  const recent = await fetch(`${API}/api/v1/events/recent?limit=30`).then((r) => r.json());
  const match = (recent.events || []).find(
    (e) => e.deviceId === deviceId && e.source === "chrome" && e.windowTitle === "example.com",
  );
  if (!match) {
    throw new Error("chrome event not found in /api/v1/events/recent");
  }

  const devices = await fetch(`${API}/api/v1/devices`).then((r) => r.json());
  const device = (devices.devices || []).find((d) => d.deviceId === deviceId);
  if (!device) throw new Error("chrome device not listed in /api/v1/devices");

  console.log("VERIFY_OK");
  console.log(
    JSON.stringify(
      {
        inserted: postBody.inserted,
        eventId: match.id,
        source: match.source,
        windowTitle: match.windowTitle,
        hostname: match.hostname,
        devicePresence: device.presence,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("VERIFY_FAILED", err.message);
  process.exit(1);
});
