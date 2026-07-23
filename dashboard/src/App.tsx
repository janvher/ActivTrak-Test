import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fetchActivityOverTime,
  fetchDevices,
  fetchRecentEvents,
  fetchSummary,
  fetchTopApps,
} from './api'
import type {
  ActivityEvent,
  ActivityPoint,
  Device,
  Presence,
  Summary,
  TimeRange,
  TopApp,
} from './types'
import {
  formatDuration,
  formatRelative,
  formatTime,
  presenceClass,
  shortId,
  toLocalInputValue,
} from './utils'
import './App.css'

const DEVICE_KEY = 'activtrak.selectedDeviceId'
const THEME_KEY = 'activtrak.theme'
const RECENT_PAGE_SIZE = 15
type RangeMode = '24h' | '7d' | 'custom'
type Theme = 'dark' | 'light'

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

function defaultRange(mode: RangeMode): TimeRange {
  const to = new Date()
  if (mode === '7d') {
    return { from: new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000), to }
  }
  return { from: new Date(to.getTime() - 24 * 60 * 60 * 1000), to }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = readTheme()
    document.documentElement.setAttribute('data-theme', initial)
    return initial
  })
  const [rangeMode, setRangeMode] = useState<RangeMode>('24h')
  const [range, setRange] = useState<TimeRange>(() => defaultRange('24h'))
  const [customFrom, setCustomFrom] = useState(() =>
    toLocalInputValue(defaultRange('24h').from),
  )
  const [customTo, setCustomTo] = useState(() =>
    toLocalInputValue(defaultRange('24h').to),
  )
  const [deviceId, setDeviceId] = useState<string>(
    () => localStorage.getItem(DEVICE_KEY) ?? '',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiDown, setApiDown] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [onlineWindowSeconds, setOnlineWindowSeconds] = useState(120)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [topApps, setTopApps] = useState<TopApp[]>([])
  const [timeline, setTimeline] = useState<ActivityPoint[]>([])
  const [recent, setRecent] = useState<ActivityEvent[]>([])
  const [recentHasMore, setRecentHasMore] = useState(false)
  const [recentLoadingMore, setRecentLoadingMore] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [appQuery, setAppQuery] = useState('')
  const [idleOnly, setIdleOnly] = useState(false)
  const recentScrollRef = useRef<HTMLDivElement | null>(null)
  const recentLoadingRef = useRef(false)
  const recentCountRef = useRef(0)
  const recentHasMoreRef = useRef(false)

  useEffect(() => {
    recentCountRef.current = recent.length
  }, [recent])

  useEffect(() => {
    recentHasMoreRef.current = recentHasMore
  }, [recentHasMore])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const loadRecentPage = useCallback(
    async (offset: number, append: boolean) => {
      if (recentLoadingRef.current) return
      recentLoadingRef.current = true
      if (append) setRecentLoadingMore(true)
      try {
        const page = await fetchRecentEvents(
          RECENT_PAGE_SIZE,
          deviceId || undefined,
          offset,
        )
        setRecent((prev) => {
          if (!append) return page.events
          const seen = new Set(prev.map((e) => e.id))
          return [...prev, ...page.events.filter((e) => !seen.has(e.id))]
        })
        setRecentHasMore(page.hasMore)
      } finally {
        recentLoadingRef.current = false
        setRecentLoadingMore(false)
      }
    },
    [deviceId],
  )

  const applyPreset = (mode: RangeMode) => {
    setRangeMode(mode)
    if (mode === 'custom') return
    const next = defaultRange(mode)
    setRange(next)
    setCustomFrom(toLocalInputValue(next.from))
    setCustomTo(toLocalInputValue(next.to))
  }

  const applyCustomRange = () => {
    const from = new Date(customFrom)
    const to = new Date(customTo)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      setError('Custom range invalid — ensure From is before To.')
      return
    }
    setRangeMode('custom')
    setRange({ from, to })
  }

  const onDeviceChange = (id: string) => {
    setDeviceId(id)
    if (id) localStorage.setItem(DEVICE_KEY, id)
    else localStorage.removeItem(DEVICE_KEY)
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const spanMs = range.to.getTime() - range.from.getTime()
      const bucket = spanMs > 36 * 60 * 60 * 1000 ? 'day' : 'hour'
      const filter = deviceId || undefined
      const [devicePayload, s, apps, points] = await Promise.all([
        fetchDevices(),
        fetchSummary(range, filter),
        fetchTopApps(range, filter, 10),
        fetchActivityOverTime(range, bucket, filter),
      ])
      setApiDown(false)
      setDevices(devicePayload.devices)
      setOnlineWindowSeconds(devicePayload.onlineWindowSeconds)
      setSummary(s)
      setTopApps(apps)
      setTimeline(points)
      setUpdatedAt(new Date())

      if (
        filter &&
        !devicePayload.devices.some((d) => d.deviceId === filter)
      ) {
        setDeviceId('')
        localStorage.removeItem(DEVICE_KEY)
      }
    } catch (err) {
      setApiDown(true)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [range, deviceId])

  // Reset recent feed when device filter changes.
  useEffect(() => {
    setRecent([])
    setRecentHasMore(false)
    void loadRecentPage(0, false)
  }, [loadRecentPage])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(id)
  }, [load])

  const onRecentScroll = () => {
    const el = recentScrollRef.current
    if (!el || !recentHasMoreRef.current || recentLoadingRef.current) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48
    if (nearBottom) {
      void loadRecentPage(recentCountRef.current, true)
    }
  }

  const onlineCount = devices.filter((d) => d.presence === 'online' || (d.online && d.status === 'running')).length
  const pausedCount = devices.filter((d) => d.presence === 'paused' || d.status === 'paused').length
  const selectedDevice = devices.find((d) => d.deviceId === deviceId)

  const maxActive = Math.max(...topApps.map((a) => a.activeMs), 1)

  const chartData = timeline.map((p) => ({
    label: new Date(p.bucket).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: range.to.getTime() - range.from.getTime() <= 36 * 60 * 60 * 1000 ? '2-digit' : undefined,
    }),
    activeMin: Math.round(p.activeMs / 60000),
    idleMin: Math.round(p.idleMs / 60000),
  }))

  const filteredRecent = useMemo(() => {
    const q = appQuery.trim().toLowerCase()
    return recent.filter((ev) => {
      if (idleOnly && !ev.isIdle) return false
      if (!q) return true
      return (
        ev.appName.toLowerCase().includes(q) ||
        ev.windowTitle.toLowerCase().includes(q)
      )
    })
  }, [recent, appQuery, idleOnly])

  // If filters hide most rows, keep prefetching so the viewport can fill.
  useEffect(() => {
    if (
      recentHasMore &&
      !recentLoadingRef.current &&
      filteredRecent.length < RECENT_PAGE_SIZE &&
      recent.length > 0
    ) {
      void loadRecentPage(recentCountRef.current, true)
    }
  }, [filteredRecent.length, recentHasMore, recent.length, loadRecentPage])

  const chartTheme =
    theme === 'light'
      ? {
          grid: 'rgba(100, 116, 139, 0.25)',
          tick: '#64748b',
          active: '#0e7490',
          idle: '#94a3b8',
          tooltipBg: '#ffffff',
          tooltipBorder: 'rgba(14, 116, 144, 0.25)',
        }
      : {
          grid: 'rgba(148, 163, 184, 0.25)',
          tick: '#94a3b8',
          active: '#22d3ee',
          idle: '#64748b',
          tooltipBg: '#0f172a',
          tooltipBorder: 'rgba(56, 189, 248, 0.35)',
        }

  const emptyReason = (() => {
    if (apiDown) return 'api'
    if (devices.length === 0) return 'no-devices'
    if (selectedDevice?.presence === 'paused' || selectedDevice?.status === 'paused') {
      return 'paused'
    }
    if (summary && summary.eventCount === 0) return 'no-events'
    return null
  })()

  return (
    <div className="page">
      <div className="bg-glow" aria-hidden />
      <div className="bg-grid" aria-hidden />

      <button
        type="button"
        className={`theme-switch theme-switch--${theme}`}
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="theme-switch__track" aria-hidden>
          <span className="theme-switch__icon theme-switch__icon--moon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z" />
              <circle cx="17.2" cy="7.2" r="1.1" />
              <circle cx="19.4" cy="10.2" r="0.7" />
            </svg>
          </span>
          <span className="theme-switch__icon theme-switch__icon--sun">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
          <span className="theme-switch__thumb" />
        </span>
      </button>

      <header className="header glass">
        <div>
          <p className="eyebrow">ActivTrak · Live Analytics</p>
          <h1>Activity Dashboard</h1>
          <p className="range-label">
            Range:{' '}
            <strong>
              {formatTime(range.from.toISOString())} →{' '}
              {formatTime(range.to.toISOString())}
            </strong>
            {deviceId ? (
              <>
                {' '}
                · Device <code>{selectedDevice?.hostname ?? shortId(deviceId)}</code>
              </>
            ) : (
              ' · All devices'
            )}
          </p>
        </div>
        <div className="header-actions">
          <label className="field">
            Device
            <select
              value={deviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
            >
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.hostname} ({presenceText(d)})
                </option>
              ))}
            </select>
          </label>
          <div className="segmented">
            <button
              type="button"
              className={rangeMode === '24h' ? 'active' : ''}
              onClick={() => applyPreset('24h')}
            >
              24h
            </button>
            <button
              type="button"
              className={rangeMode === '7d' ? 'active' : ''}
              onClick={() => applyPreset('7d')}
            >
              7d
            </button>
            <button
              type="button"
              className={rangeMode === 'custom' ? 'active' : ''}
              onClick={() => setRangeMode('custom')}
            >
              Custom
            </button>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              void load()
              void loadRecentPage(0, false)
            }}
            disabled={loading}
          >
            Refresh
          </button>
          <span className="meta">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : '…'}
          </span>
        </div>
      </header>

      {rangeMode === 'custom' && (
        <div className="custom-range glass">
          <label className="field">
            From
            <input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="field">
            To
            <input
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          <button type="button" className="primary" onClick={applyCustomRange}>
            Apply range
          </button>
        </div>
      )}

      {apiDown && (
        <div className="banner error" role="alert">
          API unreachable — is the backend running on :3001?
        </div>
      )}
      {!apiDown && error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}
      {!apiDown && emptyReason === 'no-devices' && (
        <div className="banner info">
          No devices yet — start the desktop agent (menu bar <strong>AT</strong>).
        </div>
      )}
      {!apiDown && emptyReason === 'paused' && (
        <div className="banner warn">
          Selected device is <strong>paused</strong> — resume monitoring in the
          agent tray to collect new activity.
        </div>
      )}

      <section className="stats">
        <article className="glass stat">
          <h2>Online</h2>
          <p className="stat-value">
            {onlineCount}
            <span className="stat-sub"> / {devices.length}</span>
          </p>
          <p className="stat-hint">
            Fresh within {onlineWindowSeconds}s
            {pausedCount > 0 ? ` · ${pausedCount} paused` : ''}
          </p>
        </article>
        <article className="glass stat">
          <h2>Active time</h2>
          <p className="stat-value">
            {formatDuration(summary?.totalActiveMs ?? 0)}
          </p>
        </article>
        <article className="glass stat">
          <h2>Idle time</h2>
          <p className="stat-value">
            {formatDuration(summary?.totalIdleMs ?? 0)}
          </p>
        </article>
        <article className="glass stat">
          <h2>Events</h2>
          <p className="stat-value">{summary?.eventCount ?? 0}</p>
        </article>
      </section>

      <section className="grid-2">
        <div className="panel glass">
          <h2>Devices</h2>
          {devices.length === 0 ? (
            <p className="empty">Waiting for first heartbeat / event…</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Presence</th>
                  <th>Last seen</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr
                    key={d.deviceId}
                    className={d.deviceId === deviceId ? 'selected' : undefined}
                    onClick={() => onDeviceChange(d.deviceId === deviceId ? '' : d.deviceId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span
                        className={`dot ${presenceClass(d.presence ?? (d.online ? 'online' : 'offline'))}`}
                      />
                      {d.hostname}
                    </td>
                    <td>
                      <span className={`pill ${presenceClass(d.presence)}`}>
                        {presenceText(d)}
                      </span>
                    </td>
                    <td title={formatTime(d.lastSeenAt)}>
                      {d.lastSeenAt ? formatRelative(d.lastSeenAt) : '—'}
                    </td>
                    <td>
                      <code>{shortId(d.deviceId)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel glass">
          <h2>Top applications</h2>
          {topApps.length === 0 ? (
            <p className="empty">No app data in this range.</p>
          ) : (
            <>
              <ul className="app-bars">
                {topApps.map((app) => (
                  <li key={app.appName}>
                    <div className="app-bar-meta">
                      <span>{app.appName}</span>
                      <span>{formatDuration(app.activeMs)}</span>
                    </div>
                    <div className="app-bar-track">
                      <div
                        className="app-bar-fill"
                        style={{
                          width: `${Math.max(4, (app.activeMs / maxActive) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <table>
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Active</th>
                    <th>Idle</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {topApps.map((app) => (
                    <tr key={`row-${app.appName}`}>
                      <td>{app.appName}</td>
                      <td>{formatDuration(app.activeMs)}</td>
                      <td>{formatDuration(app.idleMs)}</td>
                      <td>{app.eventCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>

      <section className="panel glass">
        <h2>Activity over time</h2>
        {chartData.every((p) => p.activeMin === 0 && p.idleMin === 0) ? (
          <p className="empty">No timeline activity in this range (buckets shown as zero-filled).</p>
        ) : (
          <div className="chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartTheme.tick }} />
                <YAxis
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  label={{
                    value: 'minutes',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: chartTheme.tick },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: chartTheme.tooltipBg,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    borderRadius: 10,
                    color: theme === 'light' ? '#0f172a' : '#e8eef8',
                  }}
                />
                <Legend />
                <Bar dataKey="activeMin" name="Active (min)" fill={chartTheme.active} radius={[4, 4, 0, 0]} />
                <Bar dataKey="idleMin" name="Idle (min)" fill={chartTheme.idle} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel glass">
        <div className="panel-head">
          <h2>Recent activity</h2>
          <div className="filters">
            <input
              type="search"
              placeholder="Filter by app or window…"
              value={appQuery}
              onChange={(e) => setAppQuery(e.target.value)}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={idleOnly}
                onChange={(e) => setIdleOnly(e.target.checked)}
              />
              Idle only
            </label>
          </div>
        </div>
        {filteredRecent.length === 0 && !recentLoadingMore ? (
          <p className="empty">No matching recent events.</p>
        ) : (
          <>
            <div
              className="table-scroll"
              role="region"
              aria-label="Recent activity"
              ref={recentScrollRef}
              onScroll={onRecentScroll}
            >
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>App</th>
                    <th>Window</th>
                    <th>Source</th>
                    <th>State</th>
                    <th>Duration</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecent.map((ev) => (
                    <tr key={ev.id}>
                      <td title={formatTime(ev.endedAt)}>
                        {formatRelative(ev.endedAt)}
                      </td>
                      <td>{ev.appName}</td>
                      <td className="truncate" title={ev.windowTitle}>
                        {ev.windowTitle || '—'}
                      </td>
                      <td>
                        <span className={`pill ${ev.source === 'chrome' ? 'source-chrome' : 'source-desktop'}`}>
                          {ev.source === 'chrome' ? 'chrome' : 'desktop'}
                        </span>
                      </td>
                      <td>
                        <span className={`pill ${ev.isIdle ? 'paused' : 'online'}`}>
                          {ev.isIdle ? 'Idle' : 'Active'}
                        </span>
                      </td>
                      <td>{formatDuration(ev.durationMs)}</td>
                      <td>{ev.hostname}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentLoadingMore && (
                <p className="table-loading">Loading more…</p>
              )}
            </div>
            <p className="table-foot">
              Showing {filteredRecent.length} loaded
              {recentHasMore ? ' · scroll for more' : ' · end of feed'}
            </p>
          </>
        )}
      </section>
    </div>
  )
}

function presenceText(d: Device): string {
  const p = (d.presence ?? (d.online ? 'online' : 'offline')) as Presence
  return p
}
