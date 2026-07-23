/**
 * ActivTrak Chrome extension — active tab/domain only.
 * No history import, no content scripts, no keylogging.
 */

const DEFAULT_API = "http://localhost:3001";
const POLL_ALARM = "activtrak-tab-poll";

let current = {
  deviceId: null,
  domain: null,
  title: null,
  startedAt: null,
  paused: false,
};

async function getSettings() {
  const data = await chrome.storage.local.get({
    apiUrl: DEFAULT_API,
    deviceId: null,
    paused: false,
  });
  if (!data.deviceId) {
    data.deviceId = crypto.randomUUID();
    await chrome.storage.local.set({ deviceId: data.deviceId });
  }
  return data;
}

function domainFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname;
  } catch {
    return null;
  }
}

async function activeTabInfo() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (!tab?.url) return null;
  const domain = domainFromUrl(tab.url);
  if (!domain) return null;
  return { domain, title: tab.title || domain };
}

async function flushSegment(endedAt = new Date()) {
  if (!current.deviceId || !current.domain || !current.startedAt) return;
  const started = new Date(current.startedAt);
  const durationMs = Math.max(0, endedAt.getTime() - started.getTime());
  if (durationMs < 1000) {
    current.domain = null;
    current.title = null;
    current.startedAt = null;
    return;
  }

  const settings = await getSettings();
  const body = {
    events: [
      {
        deviceId: current.deviceId,
        hostname: `chrome:${current.deviceId.slice(0, 8)}`,
        appName: "Google Chrome",
        windowTitle: current.domain,
        isIdle: false,
        startedAt: started.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs,
        source: "chrome",
      },
    ],
  };

  try {
    await fetch(`${settings.apiUrl.replace(/\/$/, "")}/api/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("ActivTrak extension: failed to send event", err);
  }

  current.domain = null;
  current.title = null;
  current.startedAt = null;
}

async function sendHeartbeat(status) {
  const settings = await getSettings();
  try {
    await fetch(`${settings.apiUrl.replace(/\/$/, "")}/api/v1/heartbeats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: settings.deviceId,
        hostname: `chrome:${settings.deviceId.slice(0, 8)}`,
        status,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn("ActivTrak extension: heartbeat failed", err);
  }
}

async function sample() {
  const settings = await getSettings();
  current.deviceId = settings.deviceId;
  current.paused = !!settings.paused;

  if (current.paused) {
    await flushSegment();
    return;
  }

  const info = await activeTabInfo();
  const now = new Date();
  if (!info) {
    await flushSegment(now);
    return;
  }

  if (current.domain === info.domain) {
    current.title = info.title;
    return;
  }

  await flushSegment(now);
  current.domain = info.domain;
  current.title = info.title;
  current.startedAt = now.toISOString();
}

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
  // Chrome MV3 minimum alarm period is 1 minute; tab events handle fast switches.
  await chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  await sendHeartbeat("running");
  await sample();
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  await sample();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) void sample();
});

chrome.tabs.onActivated.addListener(() => {
  void sample();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.url) void sample();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "getStatus") {
      const settings = await getSettings();
      sendResponse({
        paused: settings.paused,
        apiUrl: settings.apiUrl,
        deviceId: settings.deviceId,
        currentDomain: current.domain,
      });
      return;
    }
    if (msg?.type === "setPaused") {
      await chrome.storage.local.set({ paused: !!msg.paused });
      if (msg.paused) {
        await flushSegment();
        await sendHeartbeat("paused");
      } else {
        await sendHeartbeat("running");
        await sample();
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "setApiUrl") {
      await chrome.storage.local.set({ apiUrl: String(msg.apiUrl || DEFAULT_API) });
      sendResponse({ ok: true });
    }
  })();
  return true;
});
