import { exec } from 'child_process'
import { promisify } from 'util'
import type { PortInfo } from '../../shared/types'

const execAsync = promisify(exec)

const CRITICAL_PORTS = new Set([22, 53, 80, 443, 631, 5432, 3306, 6379, 27017])

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
    const { stdout } = await execAsync(
      'lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null || true'
    )
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
          isCritical: CRITICAL_PORTS.has(port)
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

async function scanPortsWindows(): Promise<PortInfo[]> {
  try {
    const { stdout } = await execAsync('netstat -ano -p tcp | findstr LISTENING')
    const ports: PortInfo[] = []
    const seen = new Set<string>()

    for (const line of stdout.trim().split('\n')) {
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

      let command = 'unknown'
      let user = 'unknown'
      let cpu = 0
      let memory = 0
      let memoryRSS = 0

      try {
        const { stdout: tasklist } = await execAsync(
          `tasklist /FI "PID eq ${pid}" /FO CSV /NH 2>nul`
        )
        const csvParts = tasklist.trim().split(',')
        if (csvParts.length > 0) {
          command = csvParts[0].replace(/"/g, '')
        }
        if (csvParts.length > 4) {
          const memStr = csvParts[4].replace(/"/g, '').replace(/[^0-9]/g, '')
          memoryRSS = parseInt(memStr, 10) || 0
        }
      } catch {}

      try {
        const { stdout: wmicOut } = await execAsync(
          `wmic path win32_perfformatteddata_perfproc_process where "IDProcess=${pid}" get PercentProcessorTime /value 2>nul`
        )
        const cpuMatch = wmicOut.match(/PercentProcessorTime=(\d+)/)
        if (cpuMatch) cpu = parseInt(cpuMatch[1], 10)
      } catch {}

      const isCritical = port < 1024

      ports.push({
        port,
        pid,
        command,
        projectName: command,
        projectPath: '',
        user,
        protocol: 'TCP',
        address,
        state: 'LISTEN',
        cpu,
        memory,
        memoryRSS,
        tags: [],
        isSelected: false,
        isCritical
      })
    }

    return ports
  } catch {
    return []
  }
}

async function scanPortsLinux(): Promise<PortInfo[]> {
  try {
    const { stdout } = await execAsync('ss -tlnp 2>/dev/null')
    const ports: PortInfo[] = []
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

      let command = 'unknown'
      let user = 'unknown'
      let cpu = 0
      let memory = 0
      let memoryRSS = 0

      try {
        const { stdout: psOut } = await execAsync(
          `ps -p ${pid} -o comm=,%cpu=,%mem=,rss=,user= 2>/dev/null`
        )
        const psParts = psOut.trim().split(/\s+/)
        if (psParts.length >= 4) {
          command = psParts[0]
          cpu = parseFloat(psParts[1]) || 0
          memory = parseFloat(psParts[2]) || 0
          memoryRSS = parseInt(psParts[3], 10) || 0
        }
        if (psParts.length >= 5) {
          user = psParts[4]
        }
      } catch {}

      let projectName = command
      let projectPath = ''
      try {
        const { stdout: cwdOut } = await execAsync(
          `readlink /proc/${pid}/cwd 2>/dev/null`
        )
        if (cwdOut.trim()) {
          projectPath = cwdOut.trim()
          projectName = projectPath.split('/').pop() || command
        }
      } catch {}

      const isCritical = port < 1024

      ports.push({
        port,
        pid,
        command,
        projectName,
        projectPath,
        user,
        protocol: 'TCP',
        address,
        state: 'LISTEN',
        cpu,
        memory,
        memoryRSS,
        tags: [],
        isSelected: false,
        isCritical
      })
    }

    return ports
  } catch {
    return []
  }
}

async function enrichWithResourceUsage(ports: PortInfo[]): Promise<void> {
  const pids = [...new Set(ports.map((p) => p.pid))]
  if (pids.length === 0) return

  try {
    const { stdout } = await execAsync(
      `ps -p ${pids.join(',')} -o pid=,%cpu=,%mem=,rss= 2>/dev/null || true`
    )

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
    const { stdout } = await execAsync(
      `lsof -a -p ${pids.join(',')} -d cwd -Fp -Fn 2>/dev/null || true`
    )

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
