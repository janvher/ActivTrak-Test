import { useCallback, useEffect, useMemo, useState } from 'react'
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
type RangeMode = '24h' | '7d' | 'custom'

function defaultRange(mode: RangeMode): TimeRange {
  const to = new Date()
  if (mode === '7d') {
    return { from: new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000), to }
  }
  return { from: new Date(to.getTime() - 24 * 60 * 60 * 1000), to }
}

export default function App() {
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
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [appQuery, setAppQuery] = useState('')
  const [idleOnly, setIdleOnly] = useState(false)

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
      const [devicePayload, s, apps, points, events] = await Promise.all([
        fetchDevices(),
        fetchSummary(range, filter),
        fetchTopApps(range, filter, 10),
        fetchActivityOverTime(range, bucket, filter),
        fetchRecentEvents(60, filter),
      ])
      setApiDown(false)
      setDevices(devicePayload.devices)
      setOnlineWindowSeconds(devicePayload.onlineWindowSeconds)
      setSummary(s)
      setTopApps(apps)
      setTimeline(points)
      setRecent(events)
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

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(id)
  }, [load])

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

  const recentVisible = filteredRecent.slice(0, 15)

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
          <button type="button" className="primary" onClick={() => void load()} disabled={loading}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  label={{
                    value: 'minutes',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: '#94a3b8' },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid rgba(56,189,248,0.35)',
                    borderRadius: 10,
                  }}
                />
                <Legend />
                <Bar dataKey="activeMin" name="Active (min)" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="idleMin" name="Idle (min)" fill="#64748b" radius={[4, 4, 0, 0]} />
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
        {recentVisible.length === 0 ? (
          <p className="empty">No matching recent events.</p>
        ) : (
          <>
            <div className="table-scroll" role="region" aria-label="Recent activity">
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>App</th>
                    <th>Window</th>
                    <th>State</th>
                    <th>Duration</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisible.map((ev) => (
                    <tr key={ev.id}>
                      <td title={formatTime(ev.endedAt)}>
                        {formatRelative(ev.endedAt)}
                      </td>
                      <td>{ev.appName}</td>
                      <td className="truncate" title={ev.windowTitle}>
                        {ev.windowTitle || '—'}
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
            </div>
            <p className="table-foot">
              Showing {recentVisible.length}
              {filteredRecent.length > 15
                ? ` of ${filteredRecent.length} matches (max 15)`
                : ' recent events'}
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
