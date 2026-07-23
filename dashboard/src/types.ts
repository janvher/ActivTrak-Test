export interface Device {
  deviceId: string
  hostname: string
  status: string
  lastSeenAt: string | null
  createdAt: string
  online: boolean
}

export interface Summary {
  totalActiveMs: number
  totalIdleMs: number
  eventCount: number
  deviceCount: number
  from: string
  to: string
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
