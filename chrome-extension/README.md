# Chrome Extension (optional)

Manifest V3 extension that reports the **active tab’s domain** to the ActivTrak API.

## Privacy

- Collects only the active tab hostname (shown as `windowTitle`) and marks `source: "chrome"`
- **No** history import, browsing history permission, content scripts, or keylogging
- Visible popup with **Pause / Resume**

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | Read active tab URL/title |
| `alarms` | Periodic heartbeat / flush |
| `storage` | Device ID, pause flag, API URL |
| host `localhost:3001` | POST events/heartbeats to local API |

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this `chrome-extension/` folder
4. Ensure backend is running on `http://localhost:3001`
5. Browse sites for a few seconds each, then confirm dashboard **Source = chrome**

> Note: Recent Chrome versions often ignore CLI `--load-extension`. Prefer Load unpacked in the browser UI.

### Contract verification (no UI)

```bash
node chrome-extension/verify-ingest.mjs
```

Posts the same JSON shape as `background.js` and checks `/api/v1/events/recent` for `source: "chrome"`.
