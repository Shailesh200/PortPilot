import { execFile } from 'child_process'
import { promisify } from 'util'
import { readlinkSync } from 'fs'
import type { PortInfo } from '../../shared/types'

const execFileAsync = promisify(execFile)

/** execFile that never rejects — non-zero exits and missing binaries yield empty stdout. */
async function execFileSafe(
  cmd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(cmd, args)
  } catch {
    return { stdout: '', stderr: '' }
  }
}

const CRITICAL_PORTS = new Set([22, 53, 80, 443, 631, 5432, 3306, 6379, 27017])

/** Single definition across platforms: well-known service ports + system range. */
function isCriticalPort(port: number): boolean {
  return port < 1024 || CRITICAL_PORTS.has(port)
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
    const { stdout } = await execFileSafe('lsof', [
      '-iTCP',
      '-sTCP:LISTEN',
      '-P',
      '-n'
    ])
    const lines = stdout.trim().split('\n')
    if (lines.length <= 1) return []

    const portMap = new Map<string, PortInfo>()

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/)
      if (parts.length < 9) continue

      const command = parts[0]
      const pid = parseInt(parts[1], 10)
      const user = parts[2]
      const name = parts[parts.length - 2]

      const portMatch = name.match(/:(\d+)$/)
      if (!portMatch) continue

      const port = parseInt(portMatch[1], 10)
      const address = name.replace(`:${port}`, '')
      const key = `${pid}:${port}`

      if (!portMap.has(key)) {
        portMap.set(key, {
          port,
          pid,
          command,
          projectName: '',
          projectPath: '',
          user,
          protocol: 'TCP',
          address: address || '*',
          state: 'LISTEN',
          cpu: 0,
          memory: 0,
          memoryRSS: 0,
          tags: [],
          isSelected: false,
          isCritical: isCriticalPort(port)
        })
      }
    }

    const ports = Array.from(portMap.values())
    if (ports.length > 0) {
      await Promise.all([
        enrichWithResourceUsage(ports),
        enrichWithProjectNames(ports)
      ])
    }

    return ports.sort((a, b) => a.port - b.port)
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
    const entries: { pid: number; port: number; address: string }[] = []
    const seen = new Set<string>()

    for (const line of stdout.trim().split('\n')) {
      if (!line.includes('LISTENING')) continue
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue

      const localAddr = parts[1]
      const pid = parseInt(parts[4], 10)
      if (isNaN(pid) || pid === 0) continue

      const addrParts = localAddr.split(':')
      const port = parseInt(addrParts[addrParts.length - 1], 10)
      const address = addrParts.slice(0, -1).join(':') || '0.0.0.0'
      if (isNaN(port)) continue

      const key = `${pid}:${port}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({ pid, port, address })
    }

    if (entries.length === 0) return []

    const procMap = await getWindowsProcessMap()

    return entries
      .map(({ pid, port, address }) => {
        const info = procMap.get(pid)
        return {
          port,
          pid,
          command: info?.name || 'unknown',
          projectName: info?.name || 'unknown',
          projectPath: '',
          user: 'unknown',
          protocol: 'TCP' as const,
          address,
          state: 'LISTEN',
          cpu: info?.cpu || 0,
          memory: 0,
          memoryRSS: info?.memoryKB || 0,
          tags: [],
          isSelected: false,
          isCritical: isCriticalPort(port)
        }
      })
      .sort((a, b) => a.port - b.port)
  } catch {
    return []
  }
}

async function scanPortsLinux(): Promise<PortInfo[]> {
  try {
    const { stdout } = await execFileSafe('ss', ['-tlnp'])
    const entries: { pid: number; port: number; address: string }[] = []
    const seen = new Set<string>()

    for (const line of stdout.trim().split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue

      const localAddr = parts[3]
      const addrParts = localAddr.split(':')
      const port = parseInt(addrParts[addrParts.length - 1], 10)
      const address = addrParts.slice(0, -1).join(':') || '0.0.0.0'
      if (isNaN(port)) continue

      const pidMatch = line.match(/pid=(\d+)/)
      const pid = pidMatch ? parseInt(pidMatch[1], 10) : 0
      if (pid === 0) continue

      const key = `${pid}:${port}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({ pid, port, address })
    }

    if (entries.length === 0) return []

    // One ps call for every pid instead of one per port.
    const pids = [...new Set(entries.map((e) => e.pid))]
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

    return entries
      .map(({ pid, port, address }) => {
        const info = procMap.get(pid)
        const command = info?.command || 'unknown'

        // readlinkSync on /proc — no subprocess spawn per pid.
        let projectPath = ''
        let projectName = command
        try {
          const cwd = readlinkSync(`/proc/${pid}/cwd`)
          if (cwd && cwd !== '/') {
            projectPath = cwd
            projectName = extractProjectName(cwd, command)
          }
        } catch {
          /* process gone or no permission */
        }

        return {
          port,
          pid,
          command,
          projectName,
          projectPath,
          user: info?.user || 'unknown',
          protocol: 'TCP' as const,
          address,
          state: 'LISTEN',
          cpu: info?.cpu || 0,
          memory: info?.memory || 0,
          memoryRSS: info?.memoryRSS || 0,
          tags: [],
          isSelected: false,
          isCritical: isCriticalPort(port)
        }
      })
      .sort((a, b) => a.port - b.port)
  } catch {
    return []
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

  try {
    const { stdout } = await execFileSafe('lsof', [
      '-a',
      '-p',
      pids.join(','),
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

    for (const port of ports) {
      const cwd = pidCwdMap.get(port.pid)
      if (cwd && cwd !== '/') {
        port.projectPath = cwd
        port.projectName = extractProjectName(cwd, port.command)
      } else {
        port.projectName = port.command
      }
    }
  } catch {
    for (const port of ports) {
      port.projectName = port.command
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
  const home = process.env.HOME || ''

  const skipDirs = new Set([
    '/', '/usr', '/usr/local', '/usr/local/bin', '/tmp', '/var',
    '/opt', '/opt/homebrew', home
  ])

  if (skipDirs.has(cwd)) {
    return command
  }

  const segments = cwd.split('/').filter(Boolean)

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
