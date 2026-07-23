import type {
  ActivityEvent,
  ActivityPoint,
  Device,
  Summary,
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

export function rangeQuery(hours = 24): string {
  const to = new Date()
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000)
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
}

export async function fetchDevices(): Promise<Device[]> {
  const data = await getJson<{ devices: Device[] }>('/api/v1/devices')
  return data.devices
}

export async function fetchSummary(hours = 24): Promise<Summary> {
  return getJson<Summary>(`/api/v1/stats/summary?${rangeQuery(hours)}`)
}

export async function fetchTopApps(hours = 24, limit = 10): Promise<TopApp[]> {
  const data = await getJson<{ apps: TopApp[] }>(
    `/api/v1/stats/top-apps?${rangeQuery(hours)}&limit=${limit}`,
  )
  return data.apps
}

export async function fetchActivityOverTime(
  hours = 24,
  bucket: 'hour' | 'day' = 'hour',
): Promise<ActivityPoint[]> {
  const data = await getJson<{ points: ActivityPoint[] }>(
    `/api/v1/stats/activity-over-time?${rangeQuery(hours)}&bucket=${bucket}`,
  )
  return data.points
}

export async function fetchRecentEvents(limit = 40): Promise<ActivityEvent[]> {
  const data = await getJson<{ events: ActivityEvent[] }>(
    `/api/v1/events/recent?limit=${limit}`,
  )
  return data.events
}
