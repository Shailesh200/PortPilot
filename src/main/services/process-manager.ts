import { exec, spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { shell } from 'electron'
import type { ProcessDetails } from '../../shared/types'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

export async function getProcessDetails(pid: number): Promise<ProcessDetails | null> {
  try {
    const { stdout } = await execAsync(
      `ps -p ${pid} -o pid=,%cpu=,%mem=,rss=,etime=,user=,command= 2>/dev/null`
    )

    const line = stdout.trim()
    if (!line) return null

    const parts = line.trim().split(/\s+/)
    if (parts.length < 7) return null

    const fullCommand = parts.slice(6).join(' ')

    const { stdout: childrenOut } = await execAsync(
      `pgrep -P ${pid} 2>/dev/null || true`
    )
    const children = childrenOut
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n))

    const { stdout: portsOut } = await execAsync(
      `lsof -p ${pid} -iTCP -sTCP:LISTEN -P -n 2>/dev/null || true`
    )
    const ports: number[] = []
    for (const pLine of portsOut.trim().split('\n').slice(1)) {
      const match = pLine.match(/:(\d+)\s/)
      if (match) ports.push(parseInt(match[1], 10))
    }

    return {
      pid: parseInt(parts[0], 10),
      cpu: parseFloat(parts[1]) || 0,
      memory: parseFloat(parts[2]) || 0,
      memoryRSS: parseInt(parts[3], 10) || 0,
      uptime: parts[4],
      user: parts[5],
      command: fullCommand.split('/').pop()?.split(' ')[0] || fullCommand,
      fullCommand,
      children,
      ports: [...new Set(ports)]
    }
  } catch {
    return null
  }
}

export async function getProcessLogs(pid: number): Promise<string[]> {
  const lines: string[] = []

  try {
    // Find open log/output files for this process
    const { stdout } = await execAsync(
      `lsof -p ${pid} 2>/dev/null | grep -E 'REG.*\\.(log|txt|out|err)' || true`
    )

    const logFiles = new Set<string>()
    for (const line of stdout.trim().split('\n')) {
      if (!line) continue
      const parts = line.split(/\s+/)
      // The last column in lsof output is the file path
      const filePath = parts.slice(8).join(' ')
      if (filePath && filePath.startsWith('/') && !filePath.includes('/dev/')) {
        logFiles.add(filePath)
      }
    }

    // Read last 100 lines from each discovered log file
    for (const logFile of Array.from(logFiles).slice(0, 3)) {
      try {
        const { stdout: tail } = await execAsync(
          `tail -50 "${logFile.replace(/"/g, '\\"')}" 2>/dev/null`
        )
        if (tail.trim()) {
          lines.push(`--- ${logFile} ---`)
          lines.push(...tail.trim().split('\n'))
        }
      } catch {
        // skip unreadable files
      }
    }

    // Also try to get recent syslog entries for this process
    if (lines.length === 0) {
      try {
        const { stdout: syslog } = await execAsync(
          `log show --predicate 'processID == ${pid}' --last 1m --style syslog 2>/dev/null | tail -30`
        )
        if (syslog.trim()) {
          lines.push('--- System Log ---')
          lines.push(...syslog.trim().split('\n'))
        }
      } catch {
        // system log may not be available
      }
    }
  } catch {
    // best effort
  }

  if (lines.length === 0) {
    lines.push('No log output available for this process.')
    lines.push('Logs are captured from files the process has open (.log, .txt, .out, .err)')
  }

  return lines
}

export async function killProcess(pid: number, force = false): Promise<boolean> {
  try {
    const signal = force ? '-9' : '-15'
    await execAsync(`kill ${signal} ${pid} 2>/dev/null`)
    return true
  } catch {
    if (!force) {
      return killProcess(pid, true)
    }
    return false
  }
}

export async function killProcesses(
  pids: number[]
): Promise<{ pid: number; success: boolean }[]> {
  return Promise.all(
    pids.map(async (pid) => ({
      pid,
      success: await killProcess(pid)
    }))
  )
}

export function openInBrowser(port: number): void {
  shell.openExternal(`http://localhost:${port}`)
}

async function resolveProcessCwd(pid: number): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`
    )
    for (const line of stdout.trim().split('\n')) {
      if (line.startsWith('n') && line.length > 2 && line[1] === '/') {
        return line.slice(1)
      }
    }
  } catch {
    // fall through
  }
  return process.env.HOME || '~'
}

type TerminalApp = 'terminal' | 'iterm' | 'cursor' | 'vscode' | 'warp' | 'unknown'

interface AncestorInfo {
  app: TerminalApp
  ttys: string[]
}

const TERMINAL_SIGNATURES: [string, TerminalApp][] = [
  ['Terminal.app', 'terminal'],
  ['iTerm.app', 'iterm'],
  ['iTerm2', 'iterm'],
  ['Cursor.app', 'cursor'],
  ['Code.app', 'vscode'],
  ['Visual Studio Code', 'vscode'],
  ['Warp.app', 'warp']
]

async function identifyTerminal(pid: number): Promise<AncestorInfo> {
  const ttys = new Set<string>()
  let app: TerminalApp = 'unknown'

  try {
    let current = pid
    for (let depth = 0; depth < 30 && current > 1; depth++) {
      const { stdout } = await execAsync(
        `ps -p ${current} -o ppid=,tty=,command= 2>/dev/null`
      )
      const line = stdout.trim()
      if (!line) break

      const ppidMatch = line.match(/^\s*(\d+)/)
      if (!ppidMatch) break

      const rest = line.slice(ppidMatch[0].length).trim()
      const parts = rest.split(/\s+/)
      const tty = parts[0]
      const cmd = parts.slice(1).join(' ')

      if (tty && tty !== '??' && tty !== '') {
        ttys.add(`/dev/${tty}`)
      }

      if (app === 'unknown') {
        for (const [sig, name] of TERMINAL_SIGNATURES) {
          if (cmd.includes(sig)) {
            app = name
            break
          }
        }
      }

      current = parseInt(ppidMatch[1], 10)
    }
  } catch {
    // best-effort
  }

  return { app, ttys: [...ttys] }
}

async function runAppleScript(...lines: string[]): Promise<string> {
  const args = lines.flatMap((l) => ['-e', l])
  const { stdout } = await execFileAsync('/usr/bin/osascript', args)
  return stdout.trim()
}

async function focusTerminalTab(ttys: string[]): Promise<boolean> {
  if (ttys.length === 0) return false

  try {
    const conditions = ttys.map((t) => `tty of t is "${t}"`).join(' or ')
    const result = await runAppleScript(
      'tell application "Terminal"',
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      `      if ${conditions} then`,
      '        if miniaturized of w then set miniaturized of w to false',
      '        set selected tab of w to t',
      '        set index of w to 1',
      '        activate',
      '        return "found"',
      '      end if',
      '    end repeat',
      '  end repeat',
      '  return "notfound"',
      'end tell'
    )
    return result === 'found'
  } catch {
    return false
  }
}

async function focusITermTab(ttys: string[]): Promise<boolean> {
  if (ttys.length === 0) return false

  try {
    const conditions = ttys.map((t) => `tty of s is "${t}"`).join(' or ')
    const result = await runAppleScript(
      'tell application "iTerm2"',
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      '      repeat with s in sessions of t',
      `        if ${conditions} then`,
      '          if miniaturized of w then set miniaturized of w to false',
      '          select t',
      '          select s',
      '          set index of w to 1',
      '          activate',
      '          return "found"',
      '        end if',
      '      end repeat',
      '    end repeat',
      '  end repeat',
      '  return "notfound"',
      'end tell'
    )
    return result === 'found'
  } catch {
    return false
  }
}

async function focusApp(bundleName: string): Promise<boolean> {
  try {
    await runAppleScript(
      `tell application "${bundleName}"`,
      '  reopen',
      '  activate',
      'end tell'
    )
    return true
  } catch {
    return false
  }
}

export async function openInTerminal(pid: number, projectPath?: string): Promise<void> {
  const { app, ttys } = await identifyTerminal(pid)

  switch (app) {
    case 'terminal':
      if (await focusTerminalTab(ttys)) return
      break
    case 'iterm':
      if (await focusITermTab(ttys)) return
      break
    case 'cursor':
      if (await focusApp('Cursor')) return
      break
    case 'vscode':
      if (await focusApp('Visual Studio Code')) return
      break
    case 'warp':
      if (await focusApp('Warp')) return
      break
  }

  const dir = projectPath || await resolveProcessCwd(pid)
  const escapedDir = dir.replace(/'/g, "'\\''")
  execFileAsync('/usr/bin/osascript', [
    '-e', 'tell application "Terminal"',
    '-e', '  activate',
    '-e', `  do script "cd '${escapedDir}'"`,
    '-e', 'end tell'
  ]).catch(() => {})
}

export async function openInVSCode(pid: number, projectPath?: string): Promise<void> {
  const dir = projectPath || await resolveProcessCwd(pid)

  try {
    await execAsync(`open -a "Cursor" "${dir}"`)
    return
  } catch {
    // Cursor not installed
  }

  try {
    await execAsync(`open -a "Visual Studio Code" "${dir}"`)
    return
  } catch {
    // VS Code not installed
  }

  const extendedPath = `/usr/local/bin:/opt/homebrew/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ''}`
  spawn('code', [dir], { shell: true, env: { ...process.env, PATH: extendedPath } })
}

async function getFullCommand(pid: number): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o command= 2>/dev/null`)
    const cmd = stdout.trim()
    return cmd || null
  } catch {
    return null
  }
}

export async function restartProcess(
  pid: number,
  projectPath?: string
): Promise<{ success: boolean; error?: string }> {
  const fullCommand = await getFullCommand(pid)
  if (!fullCommand) {
    return { success: false, error: 'Could not determine process command' }
  }

  const cwd = projectPath || await resolveProcessCwd(pid)

  const killed = await killProcess(pid)
  if (!killed) {
    return { success: false, error: 'Failed to kill the process' }
  }

  await new Promise((r) => setTimeout(r, 500))

  const escapedCwd = cwd.replace(/'/g, "'\\''")
  const escapedCmd = fullCommand.replace(/'/g, "'\\''")
  execFileAsync('/usr/bin/osascript', [
    '-e', 'tell application "Terminal"',
    '-e', '  activate',
    '-e', `  do script "cd '${escapedCwd}' && ${escapedCmd}"`,
    '-e', 'end tell'
  ]).catch(() => {})

  return { success: true }
}
