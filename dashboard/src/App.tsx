import { useCallback, useEffect, useState } from 'react'
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
  Summary,
  TopApp,
} from './types'
import { formatDuration, formatTime, shortId } from './utils'
import './App.css'

type RangeHours = 24 | 168

export default function App() {
  const [hours, setHours] = useState<RangeHours>(24)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [topApps, setTopApps] = useState<TopApp[]>([])
  const [timeline, setTimeline] = useState<ActivityPoint[]>([])
  const [recent, setRecent] = useState<ActivityEvent[]>([])
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const bucket = hours > 24 ? 'day' : 'hour'
      const [d, s, apps, points, events] = await Promise.all([
        fetchDevices(),
        fetchSummary(hours),
        fetchTopApps(hours, 10),
        fetchActivityOverTime(hours, bucket),
        fetchRecentEvents(40),
      ])
      setDevices(d)
      setSummary(s)
      setTopApps(apps)
      setTimeline(points)
      setRecent(events)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(id)
  }, [load])

  const onlineCount = devices.filter((d) => d.online).length
  const chartData = timeline.map((p) => ({
    label: new Date(p.bucket).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(hours <= 24 ? { hour: '2-digit' } : {}),
    }),
    activeMin: Math.round(p.activeMs / 60000),
    idleMin: Math.round(p.idleMs / 60000),
  }))

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">ActivTrak Test</p>
          <h1>Activity Dashboard</h1>
        </div>
        <div className="header-actions">
          <label className="range">
            Range
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) as RangeHours)}
            >
              <option value={24}>Last 24 hours</option>
              <option value={168}>Last 7 days</option>
            </select>
          </label>
          <button type="button" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <span className="meta">
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : '…'}
          </span>
        </div>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error} — is the API running on :3001?
        </div>
      )}

      <section className="stats">
        <article>
          <h2>Online devices</h2>
          <p className="stat-value">
            {onlineCount}
            <span className="stat-sub"> / {devices.length}</span>
          </p>
        </article>
        <article>
          <h2>Active time</h2>
          <p className="stat-value">
            {formatDuration(summary?.totalActiveMs ?? 0)}
          </p>
        </article>
        <article>
          <h2>Idle time</h2>
          <p className="stat-value">
            {formatDuration(summary?.totalIdleMs ?? 0)}
          </p>
        </article>
        <article>
          <h2>Events</h2>
          <p className="stat-value">{summary?.eventCount ?? 0}</p>
        </article>
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2>Devices</h2>
          {devices.length === 0 ? (
            <p className="empty">No devices yet — start the desktop agent.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Status</th>
                  <th>Last seen</th>
                  <th>Device ID</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.deviceId}>
                    <td>
                      <span
                        className={`dot ${d.online ? 'online' : 'offline'}`}
                        title={d.online ? 'Online' : 'Offline'}
                      />
                      {d.hostname}
                    </td>
                    <td>{d.status}</td>
                    <td>{formatTime(d.lastSeenAt)}</td>
                    <td>
                      <code>{shortId(d.deviceId)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Top applications</h2>
          {topApps.length === 0 ? (
            <p className="empty">No app data in this range.</p>
          ) : (
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
                  <tr key={app.appName}>
                    <td>{app.appName}</td>
                    <td>{formatDuration(app.activeMs)}</td>
                    <td>{formatDuration(app.idleMs)}</td>
                    <td>{app.eventCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Activity over time</h2>
        {chartData.length === 0 ? (
          <p className="empty">No timeline data yet.</p>
        ) : (
          <div className="chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7dee8" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  label={{
                    value: 'minutes',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="activeMin" name="Active (min)" fill="#0f766e" />
                <Bar dataKey="idleMin" name="Idle (min)" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Recent activity</h2>
        {recent.length === 0 ? (
          <p className="empty">No recent events.</p>
        ) : (
          <table>
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
              {recent.map((ev) => (
                <tr key={ev.id}>
                  <td>{formatTime(ev.endedAt)}</td>
                  <td>{ev.appName}</td>
                  <td className="truncate" title={ev.windowTitle}>
                    {ev.windowTitle || '—'}
                  </td>
                  <td>{ev.isIdle ? 'Idle' : 'Active'}</td>
                  <td>{formatDuration(ev.durationMs)}</td>
                  <td>{ev.hostname}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
