import type {
  ActivityEvent,
  ActivityPoint,
  DevicesResponse,
  Summary,
  TimeRange,
  TopApp,
} from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`)
  }
  return res.json() as Promise<T>
}

function qs(range: TimeRange, deviceId?: string): string {
  const params = new URLSearchParams({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  })
  if (deviceId) params.set('deviceId', deviceId)
  return params.toString()
}

export async function fetchDevices(): Promise<DevicesResponse> {
  return getJson<DevicesResponse>('/api/v1/devices')
}

export async function fetchSummary(
  range: TimeRange,
  deviceId?: string,
): Promise<Summary> {
  return getJson<Summary>(`/api/v1/stats/summary?${qs(range, deviceId)}`)
}

export async function fetchTopApps(
  range: TimeRange,
  deviceId?: string,
  limit = 10,
): Promise<TopApp[]> {
  const data = await getJson<{ apps: TopApp[] }>(
    `/api/v1/stats/top-apps?${qs(range, deviceId)}&limit=${limit}`,
  )
  return data.apps
}

export async function fetchActivityOverTime(
  range: TimeRange,
  bucket: 'hour' | 'day',
  deviceId?: string,
): Promise<ActivityPoint[]> {
  const data = await getJson<{ points: ActivityPoint[] }>(
    `/api/v1/stats/activity-over-time?${qs(range, deviceId)}&bucket=${bucket}`,
  )
  return data.points
}

export async function fetchRecentEvents(
  limit = 50,
  deviceId?: string,
): Promise<ActivityEvent[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (deviceId) params.set('deviceId', deviceId)
  const data = await getJson<{ events: ActivityEvent[] }>(
    `/api/v1/events/recent?${params}`,
  )
  return data.events
}
