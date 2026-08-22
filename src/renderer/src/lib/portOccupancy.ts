export const OCCUPANCY_SAMPLE_CAP = 80
export const OCCUPANCY_EVENT_CAP = 24
export const RECENT_STOPPED_MS = 30 * 60 * 1000

export type OccupancyEvent = {
  at: number
  kind: 'up' | 'down'
  pid: number
  command: string
}

export type PortOccupancy = {
  samples: number[]
  /** First poll in the current continuous uptime window; 0 if currently down. */
  upSince: number
  lastUp: number
  lastDown: number
  lastPid: number
  lastCommand: string
  events: OccupancyEvent[]
}

export type OccupancyMap = Record<number, PortOccupancy>

function emptyOccupancy(): PortOccupancy {
  return {
    samples: [],
    upSince: 0,
    lastUp: 0,
    lastDown: 0,
    lastPid: 0,
    lastCommand: '',
    events: []
  }
}

function pushSample(samples: number[], bit: 0 | 1): number[] {
  const next = samples.length >= OCCUPANCY_SAMPLE_CAP ? samples.slice(1) : samples.slice()
  next.push(bit)
  return next
}

function pushEvent(
  events: OccupancyEvent[],
  event: OccupancyEvent
): OccupancyEvent[] {
  const next = [event, ...events]
  return next.length > OCCUPANCY_EVENT_CAP
    ? next.slice(0, OCCUPANCY_EVENT_CAP)
    : next
}

export function recordOccupancy(
  prev: OccupancyMap,
  ports: { port: number; pid: number; command: string }[],
  now = Date.now()
): OccupancyMap {
  const live = new Map<number, { pid: number; command: string }>()
  for (const p of ports) {
    if (!live.has(p.port)) live.set(p.port, { pid: p.pid, command: p.command })
  }

  const next: OccupancyMap = { ...prev }
  const seen = new Set<number>()

  for (const [port, info] of live) {
    seen.add(port)
    const cur = next[port] ?? emptyOccupancy()
    const wasUp = cur.samples[cur.samples.length - 1] === 1
    const firstSighting = cur.samples.length === 0
    const events =
      wasUp || firstSighting
        ? cur.events
        : pushEvent(cur.events, {
            at: now,
            kind: 'up',
            pid: info.pid,
            command: info.command
          })
    next[port] = {
      samples: pushSample(cur.samples, 1),
      upSince: wasUp && cur.upSince ? cur.upSince : now,
      lastUp: now,
      lastDown: cur.lastDown,
      lastPid: info.pid,
      lastCommand: info.command,
      events
    }
  }

  for (const [portKey, cur] of Object.entries(next)) {
    const port = Number(portKey)
    if (seen.has(port)) continue
    const wasUp = cur.samples[cur.samples.length - 1] === 1
    if (!wasUp && cur.samples.length === 0) continue
    const events = wasUp
      ? pushEvent(cur.events, {
          at: now,
          kind: 'down',
          pid: cur.lastPid,
          command: cur.lastCommand
        })
      : cur.events
    next[port] = {
      ...cur,
      samples: pushSample(cur.samples, 0),
      upSince: 0,
      lastDown: wasUp ? now : cur.lastDown,
      events
    }
  }

  return next
}

export function recentlyStopped(
  occupancy: OccupancyMap,
  now = Date.now()
): { port: number; command: string; at: number }[] {
  const out: { port: number; command: string; at: number }[] = []
  for (const [portKey, cur] of Object.entries(occupancy)) {
    if (cur.samples[cur.samples.length - 1] === 1) continue
    if (!cur.lastDown || now - cur.lastDown > RECENT_STOPPED_MS) continue
    out.push({
      port: Number(portKey),
      command: cur.lastCommand,
      at: cur.lastDown
    })
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 8)
}

export function formatUptime(ms: number): string {
  if (ms < 0) return '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ${sec % 60}s`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr}h ${min % 60}m`
  const days = Math.floor(hr / 24)
  return `${days}d ${hr % 24}h`
}

export function formatAgo(at: number, now = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - at) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m ago`
}
