import { readlinkSync } from 'fs'
import type { PortInfo } from '../../shared/types'
import { isSystemProcess } from '../../shared/system-process'
import { runtimeLabel } from '../../shared/runtime-label'
import { execFileSafe } from '../os/exec-file-safe'

const CRITICAL_PORTS = new Set([22, 53, 80, 443, 631, 5432, 3306, 6379, 27017])

/** Cache project-path enrichment — paths change rarely vs CPU/mem every poll. */
const PROJECT_PATH_CACHE_MS = 15_000
const projectPathCache = new Map<number, { path: string; at: number }>()

function getCachedProjectPath(pid: number): string | null {
  const hit = projectPathCache.get(pid)
  if (!hit) return null
  if (Date.now() - hit.at > PROJECT_PATH_CACHE_MS) return null
  return hit.path
}

function setCachedProjectPath(pid: number, path: string): void {
  projectPathCache.set(pid, { path, at: Date.now() })
}

function pruneProjectPathCache(livePids: Iterable<number>): void {
  const live = new Set(livePids)
  for (const pid of projectPathCache.keys()) {
    if (!live.has(pid)) projectPathCache.delete(pid)
  }
}

function applyProjectPath(port: PortInfo, cwd: string): void {
  if (cwd && cwd !== '/' && cwd !== '\\') {
    port.projectPath = cwd
    port.projectName = extractProjectName(cwd, port.command)
  } else {
    port.projectName = port.command
  }
}

/** Single definition across platforms: well-known service ports + system range. */
function isCriticalPort(port: number): boolean {
  return port < 1024 || CRITICAL_PORTS.has(port)
}

function stampSystem(port: PortInfo): PortInfo {
  port.isSystem = isSystemProcess(port)
  port.runtime = runtimeLabel(port.command) || port.runtime || ''
  return port
}

function stampSystemAll(ports: PortInfo[]): PortInfo[] {
  for (const p of ports) stampSystem(p)
  return ports
}

function splitHostPort(raw: string): { host: string; port: number } | null {
  const s = raw.trim()
  const m = s.match(/^(.*):(\d+)$/)
  if (!m) return null
  const host = m[1].replace(/^\[|\]$/g, '') || '*'
  const port = parseInt(m[2], 10)
  if (!Number.isFinite(port)) return null
  return { host, port }
}

function emptyPort(partial: {
  port: number
  pid: number
  command: string
  projectName?: string
  projectPath?: string
  user: string
  address: string
  state: string
  cpu?: number
  memory?: number
  memoryRSS?: number
  isCritical: boolean
  role?: 'listen' | 'connection'
  peerAddress?: string
  peerPort?: number
}): PortInfo {
  return {
    port: partial.port,
    pid: partial.pid,
    command: partial.command,
    projectName: partial.projectName || '',
    projectPath: partial.projectPath || '',
    user: partial.user,
    protocol: 'TCP',
    address: partial.address || '*',
    state: partial.state,
    cpu: partial.cpu || 0,
    memory: partial.memory || 0,
    memoryRSS: partial.memoryRSS || 0,
    tags: [],
    isSelected: false,
    isCritical: partial.isCritical,
    isSystem: false,
    role: partial.role || 'listen',
    peerAddress: partial.peerAddress || '',
    peerPort: partial.peerPort || 0,
    connectionCount: 0,
    runtime: runtimeLabel(partial.command) || ''
  }
}

const MAX_INBOUND = 150

/** Keep ESTABLISHED rows only when they talk to a local listener. Attach counts. */
function mergeInbound(
  listeners: PortInfo[],
  established: PortInfo[]
): PortInfo[] {
  const listenPorts = new Set(listeners.map((p) => p.port))
  const inbound = established
    .filter((c) => listenPorts.has(c.port))
    .slice(0, MAX_INBOUND)
  const counts = new Map<number, number>()
  for (const c of inbound) {
    counts.set(c.port, (counts.get(c.port) || 0) + 1)
  }
  for (const p of listeners) {
    p.role = 'listen'
    p.connectionCount = counts.get(p.port) || 0
  }
  for (const c of inbound) {
    c.role = 'connection'
    const owner = listeners.find((l) => l.port === c.port && l.pid === c.pid)
    if (owner) {
      c.command = owner.command
      c.user = owner.user
      c.projectName = owner.projectName
      c.projectPath = owner.projectPath
      c.cpu = owner.cpu
      c.memory = owner.memory
      c.memoryRSS = owner.memoryRSS
    }
  }
  return [...listeners, ...inbound]
}

export async function scanPorts(): Promise<PortInfo[]> {
  switch (process.platform) {
    case 'win32':
      return scanPortsWindows()
    case 'linux':
      return scanPortsLinux()
    default:
      return scanPortsDarwin()
  }
}

async function scanPortsDarwin(): Promise<PortInfo[]> {
  try {
    const { stdout } = await execFileSafe('lsof', ['-iTCP', '-P', '-n'])
    const lines = stdout.trim().split('\n')
    if (lines.length <= 1) return []

    const listenMap = new Map<string, PortInfo>()
    const established: PortInfo[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/)
      if (parts.length < 9) continue

      const command = parts[0]
      const pid = parseInt(parts[1], 10)
      const user = parts[2]
      const stateTok = parts[parts.length - 1].replace(/[()]/g, '').toUpperCase()
      const name = parts[parts.length - 2]
      if (stateTok !== 'LISTEN' && stateTok !== 'ESTABLISHED') continue

      const [localPart, peerPart] = name.split('->')
      const local = splitHostPort(localPart || '')
      if (!local) continue

      if (stateTok === 'LISTEN') {
        const key = `${pid}:${local.port}`
        if (listenMap.has(key)) continue
        listenMap.set(
          key,
          emptyPort({
            port: local.port,
            pid,
            command,
            user,
            address: local.host,
            state: 'LISTEN',
            isCritical: isCriticalPort(local.port)
          })
        )
        continue
      }

      const peer = splitHostPort(peerPart || '')
      established.push(
        emptyPort({
          port: local.port,
          pid,
          command,
          user,
          address: local.host,
          state: 'ESTABLISHED',
          isCritical: isCriticalPort(local.port),
          role: 'connection',
          peerAddress: peer?.host || '',
          peerPort: peer?.port || 0
        })
      )
    }

    const listeners = Array.from(listenMap.values())
    if (listeners.length > 0) {
      await Promise.all([
        enrichWithResourceUsage(listeners),
        enrichWithProjectNames(listeners)
      ])
    }
    const ports = mergeInbound(listeners, established)
    pruneProjectPathCache(ports.map((p) => p.pid))
    return stampSystemAll(ports.sort((a, b) => a.port - b.port || a.pid - b.pid))
  } catch {
    return []
  }
}

interface WindowsProcInfo {
  name: string
  memoryKB: number
  cpu: number
}

/**
 * One PowerShell invocation for ALL processes — the previous version ran
 * tasklist + wmic per port (N+1 spawns), and wmic is removed from Windows 11.
 */
async function getWindowsProcessMap(): Promise<Map<number, WindowsProcInfo>> {
  const map = new Map<number, WindowsProcInfo>()
  const { stdout } = await execFileSafe('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '$p = Get-CimInstance Win32_Process | Select-Object ProcessId, Name, WorkingSetSize;' +
      '$c = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Select-Object IDProcess, PercentProcessorTime;' +
      '@{ proc = @($p); cpu = @($c) } | ConvertTo-Json -Compress -Depth 3'
  ])
  if (!stdout.trim()) return map

  try {
    const parsed = JSON.parse(stdout) as {
      proc?: { ProcessId: number; Name: string; WorkingSetSize: number }[]
      cpu?: { IDProcess: number; PercentProcessorTime: number }[]
    }
    const cpuByPid = new Map<number, number>()
    for (const c of parsed.cpu || []) {
      cpuByPid.set(c.IDProcess, c.PercentProcessorTime)
    }
    for (const p of parsed.proc || []) {
      map.set(p.ProcessId, {
        name: p.Name || 'unknown',
        memoryKB: Math.round((p.WorkingSetSize || 0) / 1024),
        cpu: cpuByPid.get(p.ProcessId) || 0
      })
    }
  } catch {
    /* malformed JSON — return what we have */
  }
  return map
}

async function scanPortsWindows(): Promise<PortInfo[]> {
  try {
    const { stdout } = await execFileSafe('netstat', ['-ano', '-p', 'tcp'])
    const listenKeys = new Set<string>()
    const listeners: PortInfo[] = []
    const established: PortInfo[] = []

    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue
      const proto = parts[0].toUpperCase()
      if (proto !== 'TCP') continue
      const state = parts[3].toUpperCase()
      const pid = parseInt(parts[4], 10)
      if (isNaN(pid) || pid === 0) continue
      const local = splitHostPort(parts[1])
      if (!local) continue

      if (state === 'LISTENING' || state === 'LISTEN') {
        const key = `${pid}:${local.port}`
        if (listenKeys.has(key)) continue
        listenKeys.add(key)
        listeners.push(
          emptyPort({
            port: local.port,
            pid,
            command: 'unknown',
            projectName: 'unknown',
            user: 'unknown',
            address: local.host || '0.0.0.0',
            state: 'LISTEN',
            isCritical: isCriticalPort(local.port)
          })
        )
        continue
      }

      if (state !== 'ESTABLISHED') continue
      const peer = splitHostPort(parts[2])
      established.push(
        emptyPort({
          port: local.port,
          pid,
          command: 'unknown',
          projectName: 'unknown',
          user: 'unknown',
          address: local.host,
          state: 'ESTABLISHED',
          isCritical: isCriticalPort(local.port),
          role: 'connection',
          peerAddress: peer?.host || '',
          peerPort: peer?.port || 0
        })
      )
    }

    if (listeners.length === 0) return []

    const procMap = await getWindowsProcessMap()
    for (const p of [...listeners, ...established]) {
      const info = procMap.get(p.pid)
      if (!info) continue
      p.command = info.name
      p.projectName = info.name
      p.cpu = info.cpu
      p.memoryRSS = info.memoryKB
    }

    await enrichWindowsProjectPaths(listeners)
    const ports = mergeInbound(listeners, established)
    pruneProjectPathCache(ports.map((p) => p.pid))
    return stampSystemAll(ports.sort((a, b) => a.port - b.port || a.pid - b.pid))
  } catch {
    return []
  }
}

async function scanPortsLinux(): Promise<PortInfo[]> {
  try {
    const { stdout } = await execFileSafe('ss', ['-tanp'])
    const listeners: PortInfo[] = []
    const established: PortInfo[] = []
    const listenKeys = new Set<string>()

    for (const line of stdout.trim().split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue
      const state = parts[0].toUpperCase()
      const local = splitHostPort(parts[3] || '')
      if (!local) continue
      const pidMatch = line.match(/pid=(\d+)/)
      const pid = pidMatch ? parseInt(pidMatch[1], 10) : 0
      if (pid === 0) continue

      if (state === 'LISTEN') {
        const key = `${pid}:${local.port}`
        if (listenKeys.has(key)) continue
        listenKeys.add(key)
        listeners.push(
          emptyPort({
            port: local.port,
            pid,
            command: 'unknown',
            user: 'unknown',
            address: local.host,
            state: 'LISTEN',
            isCritical: isCriticalPort(local.port)
          })
        )
        continue
      }

      if (state !== 'ESTAB' && state !== 'ESTABLISHED') continue
      const peer = splitHostPort(parts[4] || '')
      established.push(
        emptyPort({
          port: local.port,
          pid,
          command: 'unknown',
          user: 'unknown',
          address: local.host,
          state: 'ESTABLISHED',
          isCritical: isCriticalPort(local.port),
          role: 'connection',
          peerAddress: peer?.host || '',
          peerPort: peer?.port || 0
        })
      )
    }

    if (listeners.length === 0) return []

    const pids = [...new Set(listeners.map((e) => e.pid))]
    const { stdout: psOut } = await execFileSafe('ps', [
      '-p',
      pids.join(','),
      '-o',
      'pid=,comm=,%cpu=,%mem=,rss=,user='
    ])
    const procMap = new Map<
      number,
      { command: string; cpu: number; memory: number; memoryRSS: number; user: string }
    >()
    for (const line of psOut.trim().split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 6) continue
      const pid = parseInt(parts[0], 10)
      if (isNaN(pid)) continue
      procMap.set(pid, {
        command: parts[1],
        cpu: parseFloat(parts[2]) || 0,
        memory: parseFloat(parts[3]) || 0,
        memoryRSS: parseInt(parts[4], 10) || 0,
        user: parts[5]
      })
    }

    for (const p of listeners) {
      const info = procMap.get(p.pid)
      const command = info?.command || 'unknown'
      p.command = command
      p.user = info?.user || 'unknown'
      p.cpu = info?.cpu || 0
      p.memory = info?.memory || 0
      p.memoryRSS = info?.memoryRSS || 0

      const cached = getCachedProjectPath(p.pid)
      if (cached != null) {
        p.projectPath = cached
        p.projectName = cached ? extractProjectName(cached, command) : command
      } else {
        try {
          const cwd = readlinkSync(`/proc/${p.pid}/cwd`)
          if (cwd && cwd !== '/') {
            p.projectPath = cwd
            p.projectName = extractProjectName(cwd, command)
            setCachedProjectPath(p.pid, cwd)
          } else {
            setCachedProjectPath(p.pid, '')
            p.projectName = command
          }
        } catch {
          setCachedProjectPath(p.pid, '')
          p.projectName = command
        }
      }
    }

    const ports = mergeInbound(listeners, established)
    pruneProjectPathCache(ports.map((p) => p.pid))
    return stampSystemAll(ports.sort((a, b) => a.port - b.port || a.pid - b.pid))
  } catch {
    return []
  }
}

async function enrichWindowsProjectPaths(
  ports: PortInfo[]
): Promise<void> {
  const pids = [...new Set(ports.map((p) => p.pid))]
  const stale = pids.filter((pid) => getCachedProjectPath(pid) == null)
  for (const port of ports) {
    const cached = getCachedProjectPath(port.pid)
    if (cached != null) applyProjectPath(port, cached)
  }
  if (stale.length === 0) return

  // One PowerShell call for ExecutablePath of all stale pids.
  const filter = stale.map((p) => `ProcessId=${p}`).join(' OR ')
  const { stdout } = await execFileSafe('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Get-CimInstance Win32_Process -Filter "${filter}" | Select-Object ProcessId, ExecutablePath | ConvertTo-Json -Compress`
  ])
  if (!stdout.trim()) {
    for (const pid of stale) setCachedProjectPath(pid, '')
    return
  }
  try {
    const parsed = JSON.parse(stdout) as
      | { ProcessId: number; ExecutablePath?: string }
      | { ProcessId: number; ExecutablePath?: string }[]
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    const map = new Map<number, string>()
    for (const row of rows) {
      const exe = row.ExecutablePath || ''
      // Use directory of the executable as a stand-in for cwd on Windows.
      const dir = exe.includes('\\')
        ? exe.slice(0, exe.lastIndexOf('\\'))
        : exe.includes('/')
          ? exe.slice(0, exe.lastIndexOf('/'))
          : ''
      map.set(row.ProcessId, dir)
    }
    for (const pid of stale) {
      setCachedProjectPath(pid, map.get(pid) || '')
    }
    for (const port of ports) {
      const cached = getCachedProjectPath(port.pid)
      if (cached != null) applyProjectPath(port, cached)
    }
  } catch {
    for (const pid of stale) setCachedProjectPath(pid, '')
  }
}

async function enrichWithResourceUsage(ports: PortInfo[]): Promise<void> {
  const pids = [...new Set(ports.map((p) => p.pid))]
  if (pids.length === 0) return

  try {
    const { stdout } = await execFileSafe('ps', [
      '-p',
      pids.join(','),
      '-o',
      'pid=,%cpu=,%mem=,rss='
    ])

    const pidStats = new Map<number, { cpu: number; mem: number; rss: number }>()

    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 4) {
        pidStats.set(parseInt(parts[0], 10), {
          cpu: parseFloat(parts[1]) || 0,
          mem: parseFloat(parts[2]) || 0,
          rss: parseInt(parts[3], 10) || 0
        })
      }
    }

    for (const port of ports) {
      const stats = pidStats.get(port.pid)
      if (stats) {
        port.cpu = stats.cpu
        port.memory = stats.mem
        port.memoryRSS = stats.rss
      }
    }
  } catch {
    // best-effort
  }
}

async function enrichWithProjectNames(ports: PortInfo[]): Promise<void> {
  const pids = [...new Set(ports.map((p) => p.pid))]
  if (pids.length === 0) return

  const stalePids = pids.filter((pid) => getCachedProjectPath(pid) == null)

  for (const port of ports) {
    const cached = getCachedProjectPath(port.pid)
    if (cached != null) applyProjectPath(port, cached)
  }

  if (stalePids.length === 0) return

  try {
    const { stdout } = await execFileSafe('lsof', [
      '-a',
      '-p',
      stalePids.join(','),
      '-d',
      'cwd',
      '-Fp',
      '-Fn'
    ])

    const pidCwdMap = new Map<number, string>()
    let currentPid = 0
    let sawCwd = false

    for (const line of stdout.trim().split('\n')) {
      if (line.startsWith('p')) {
        currentPid = parseInt(line.slice(1), 10)
        sawCwd = false
      } else if (line === 'fcwd') {
        sawCwd = true
      } else if (line.startsWith('n') && currentPid > 0 && sawCwd) {
        pidCwdMap.set(currentPid, line.slice(1))
        sawCwd = false
      }
    }

    for (const pid of stalePids) {
      const cwd = pidCwdMap.get(pid) || ''
      setCachedProjectPath(pid, cwd === '/' ? '' : cwd)
    }

    for (const port of ports) {
      const hit = projectPathCache.get(port.pid)
      if (!hit) {
        port.projectName = port.command
        continue
      }
      applyProjectPath(port, hit.path)
    }
  } catch {
    for (const port of ports) {
      if (!port.projectName) port.projectName = port.command
    }
  }
}

const MONOREPO_SUBDIRS = new Set([
  'apps', 'packages', 'services', 'libs', 'modules', 'workspaces', 'projects'
])

const GENERIC_SUBDIRS = new Set([
  'src', 'bin', 'lib', 'dist', 'build', 'out', 'server', 'client',
  'frontend', 'backend', 'api', 'web', 'app', 'cmd', 'internal'
])

function extractProjectName(cwd: string, command: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const normalized = cwd.replace(/\\/g, '/')

  const skipDirs = new Set([
    '/', '/usr', '/usr/local', '/usr/local/bin', '/tmp', '/var',
    '/opt', '/opt/homebrew', home.replace(/\\/g, '/')
  ])

  if (skipDirs.has(normalized)) {
    return command
  }

  const segments = normalized.split('/').filter(Boolean)

  for (let i = segments.length - 1; i >= 1; i--) {
    const dir = segments[i]
    const parent = segments[i - 1]

    if (MONOREPO_SUBDIRS.has(parent)) {
      const rootIdx = i - 2
      if (rootIdx >= 0) {
        return segments[rootIdx]
      }
    }

    if (MONOREPO_SUBDIRS.has(dir)) {
      if (i >= 1) {
        return segments[i - 1]
      }
    }
  }

  for (let i = segments.length - 1; i >= 1; i--) {
    if (GENERIC_SUBDIRS.has(segments[i])) {
      continue
    }
    if (segments[i].startsWith('.')) {
      continue
    }
    return segments[i]
  }

  return segments[segments.length - 1] || command
}
