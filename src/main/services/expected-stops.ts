/** Ports/PIDs we intentionally stopped — suppress "disappeared" crash alerts. */

const DEFAULT_TTL_MS = 45_000

const byPort = new Map<number, number>()
const byPid = new Map<number, number>()

function prune(now: number): void {
  for (const [port, exp] of byPort) {
    if (exp <= now) byPort.delete(port)
  }
  for (const [pid, exp] of byPid) {
    if (exp <= now) byPid.delete(pid)
  }
}

export function markExpectedStop(
  port: number | undefined,
  pid: number | undefined,
  ttlMs = DEFAULT_TTL_MS
): void {
  const exp = Date.now() + ttlMs
  if (typeof port === 'number' && port > 0) byPort.set(port, exp)
  if (typeof pid === 'number' && pid > 0) byPid.set(pid, exp)
}

export function markExpectedStopsForPid(
  pid: number,
  ports: Array<{ port: number; pid: number }>
): void {
  markExpectedStop(undefined, pid)
  for (const p of ports) {
    if (p.pid === pid) markExpectedStop(p.port, pid)
  }
}

export function consumeExpectedStop(port: number, pid?: number): boolean {
  const now = Date.now()
  prune(now)
  let hit = false
  const portExp = byPort.get(port)
  if (portExp != null && portExp > now) {
    byPort.delete(port)
    hit = true
  }
  if (typeof pid === 'number') {
    const pidExp = byPid.get(pid)
    if (pidExp != null && pidExp > now) {
      byPid.delete(pid)
      hit = true
    }
  }
  return hit
}
