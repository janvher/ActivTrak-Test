export type Presence = 'online' | 'paused' | 'offline' | 'stopped'

export interface Device {
  deviceId: string
  hostname: string
  status: string
  lastSeenAt: string | null
  createdAt: string
  online: boolean
  presence?: Presence
}

export interface DevicesResponse {
  devices: Device[]
  onlineWindowMs: number
  onlineWindowSeconds: number
}

export interface Summary {
  totalActiveMs: number
  totalIdleMs: number
  eventCount: number
  deviceCount: number
  from: string
  to: string
  deviceId?: string | null
}

export interface TopApp {
  appName: string
  activeMs: number
  idleMs: number
  eventCount: number
}

export interface ActivityPoint {
  bucket: string
  activeMs: number
  idleMs: number
}

export interface ActivityEvent {
  id: number
  deviceId: string
  hostname: string
  appName: string
  windowTitle: string
  isIdle: boolean
  startedAt: string
  endedAt: string
  durationMs: number
  source: string
}

export interface TimeRange {
  from: Date
  to: Date
}
