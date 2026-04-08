import { exec, spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
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

function isNoisePath(p: string): boolean {
  const n = p.toLowerCase()
  return (
    n.includes('/node_modules/') ||
    n.includes('/.git/') ||
    n.includes('/library/') ||
    n.includes('/frameworks/') ||
    n.includes('.app/contents/') ||
    n.includes('/proc/') ||
    n.includes('/dev/') ||
    n.endsWith('.node') ||
    n.endsWith('.dylib') ||
    n.endsWith('.so') ||
    n.endsWith('.wasm') ||
    n.endsWith('.pack') ||
    n.endsWith('.pack.gz')
  )
}

function scoreLogPath(p: string): number {
  const n = p.toLowerCase()
  let s = 0
  if (n.includes('.log')) s += 10
  if (n.includes('vite')) s += 5
  if (n.includes('next')) s += 5
  if (n.includes('npm')) s += 3
  if (n.includes('debug')) s += 3
  if (n.includes('.txt') || n.includes('.out') || n.includes('.err')) s += 4
  if (n.includes('trace')) s += 2
  return s
}

export async function getProcessLogs(pid: number): Promise<string[]> {
  const lines: string[] = []
  const logFiles = new Set<string>()

  const cwd = await resolveProcessCwd(pid)

  try {
    const { stdout: fnOut } = await execAsync(`lsof -p ${pid} -Fn 2>/dev/null || true`)
    for (const line of fnOut.split('\n')) {
      if (line.startsWith('n/')) {
        const filePath = line.slice(1).split('\0')[0]
        if (!filePath.startsWith('/')) continue
        if (isNoisePath(filePath)) continue
        if (filePath.length > 4096) continue
        logFiles.add(filePath)
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const qc = cwd.replace(/'/g, "'\\''")
    const { stdout: findOut } = await execAsync(
      `find '${qc}' -maxdepth 5 \\( -name "*.log" -o -name "npm-debug.log*" -o -name "yarn-debug.log*" -o -name "vite.config.*.timestamp-*" \\) -type f -mmin -720 2>/dev/null | head -25`
    )
    for (const p of findOut.trim().split('\n')) {
      if (p && p.startsWith('/') && !isNoisePath(p)) logFiles.add(p)
    }
  } catch {
    /* ignore */
  }

  const ranked = [...logFiles].sort(
    (a, b) => scoreLogPath(b) - scoreLogPath(a) || b.length - a.length
  )

  for (const logFile of ranked.slice(0, 6)) {
    try {
      const { stdout: tail } = await execAsync(
        `tail -n 80 "${logFile.replace(/"/g, '\\"')}" 2>/dev/null`
      )
      if (tail.trim()) {
        lines.push(`--- ${logFile} ---`)
        lines.push(...tail.trim().split('\n'))
      }
    } catch {
      /* skip */
    }
  }

  if (lines.length === 0) {
    try {
      const { stdout: syslog } = await execAsync(
        `log show --predicate 'processID == ${pid}' --last 5m --style syslog 2>/dev/null | tail -40`
      )
      if (syslog.trim()) {
        lines.push('--- System Log (last 5m) ---')
        lines.push(...syslog.trim().split('\n'))
      }
    } catch {
      /* ignore */
    }
  }

  if (lines.length === 0) {
    lines.push('No log files found for this process.')
    lines.push(
      'Dev servers usually log to the terminal only. PortPilot reads open files under the project and common *.log paths.'
    )
    lines.push(`Project cwd: ${cwd}`)
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
  ['/warp.app/', 'warp'],
  ['warp.app', 'warp'],
  ['macos/stable', 'warp'],
  ['contents/macos/stable', 'warp']
]

function addProcessTty(ttys: Set<string>, raw: string): void {
  const t = raw.trim()
  if (!t || t === '??' || t === '?' || t === '') return
  ttys.add(t.startsWith('/dev/') ? t : `/dev/${t}`)
}

async function identifyTerminal(pid: number): Promise<AncestorInfo> {
  const ttys = new Set<string>()
  let app: TerminalApp = 'unknown'

  try {
    const { stdout: leafTty } = await execAsync(
      `ps -p ${pid} -o tty= 2>/dev/null`
    )
    addProcessTty(ttys, leafTty)
  } catch {
    // ignore
  }

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
        addProcessTty(ttys, tty)
      }

      if (app === 'unknown') {
        const cmdLower = cmd.toLowerCase()
        for (const [sig, name] of TERMINAL_SIGNATURES) {
          if (cmdLower.includes(sig.toLowerCase())) {
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

  if (app === 'unknown') {
    try {
      const { stdout: psEnv } = await execAsync(
        `ps eww -p ${pid} 2>/dev/null || true`
      )
      if (/TERM_PROGRAM=warp/i.test(psEnv)) {
        app = 'warp'
      }
    } catch {
      /* ignore */
    }
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

/**
 * Open Warp at a working directory. Warp's GUI binary is often `stable` under
 * Warp.app — detection uses that path. macOS `open` with warp:// is more
 * reliable than shell.openExternal from Electron for custom URL schemes.
 */
async function openWarpTabAtDirectory(dir: string): Promise<boolean> {
  const q = encodeURIComponent(dir)
  const uris = [
    `warp://action/new_tab?path=${q}`,
    `warppreview://action/new_tab?path=${q}`,
    `warp://action/new_window?path=${q}`,
    `warppreview://action/new_window?path=${q}`
  ]

  for (const uri of uris) {
    try {
      await execFileAsync('open', [uri])
      return true
    } catch {
      /* try next */
    }
  }

  try {
    await shell.openExternal(uris[0])
    return true
  } catch {
    /* fall through */
  }

  try {
    await execFileAsync('open', ['-a', 'Warp', dir])
    return true
  } catch {
    /* try Warp Preview app name */
  }

  try {
    await execFileAsync('open', ['-a', 'Warp Preview', dir])
    return true
  } catch {
    return false
  }
}

function writeRestartShellScript(cwd: string, fullCommand: string): string {
  const sp = join(
    tmpdir(),
    `pp-r-${Date.now()}-${Math.random().toString(16).slice(2)}.sh`
  )
  const body = `#!/bin/bash
set +e
cd ${JSON.stringify(cwd)}
${fullCommand}
`
  writeFileSync(sp, body, { mode: 0o700 })
  return sp
}

function scheduleDeleteScript(sp: string): void {
  setTimeout(() => {
    try {
      unlinkSync(sp)
    } catch {
      /* ignore */
    }
  }, 20000)
}

async function runCommandInTerminalTab(
  ttys: string[],
  cwd: string,
  fullCommand: string
): Promise<boolean> {
  if (ttys.length === 0) return false
  const sp = writeRestartShellScript(cwd, fullCommand)
  const conditions = ttys.map((t) => `tty of t is "${t}"`).join(' or ')
  const esc = sp.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  try {
    const result = await runAppleScript(
      'tell application "Terminal"',
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      `      if ${conditions} then`,
      '        if miniaturized of w then set miniaturized of w to false',
      `        do script "exec /bin/bash \\"${esc}\\"" in t`,
      '        activate',
      '        return "ok"',
      '      end if',
      '    end repeat',
      '  end repeat',
      '  return "no"',
      'end tell'
    )
    scheduleDeleteScript(sp)
    return result === 'ok'
  } catch {
    try {
      unlinkSync(sp)
    } catch {
      /* ignore */
    }
    return false
  }
}

async function runCommandInITermTab(
  ttys: string[],
  cwd: string,
  fullCommand: string
): Promise<boolean> {
  if (ttys.length === 0) return false
  const sp = writeRestartShellScript(cwd, fullCommand)
  const conditions = ttys.map((t) => `tty of s is "${t}"`).join(' or ')
  const esc = sp.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  try {
    const result = await runAppleScript(
      'tell application "iTerm2"',
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      '      repeat with s in sessions of t',
      `        if ${conditions} then`,
      '          if miniaturized of w then set miniaturized of w to false',
      '          select t',
      '          select s',
          `          tell s to write text ("exec /bin/bash \\"${esc}\\"" & return)`,
      '          activate',
      '          return "ok"',
      '        end if',
      '      end repeat',
      '    end repeat',
      '  end repeat',
      '  return "no"',
      'end tell'
    )
    scheduleDeleteScript(sp)
    return result === 'ok'
  } catch {
    try {
      unlinkSync(sp)
    } catch {
      /* ignore */
    }
    return false
  }
}

export async function openInTerminal(pid: number, projectPath?: string): Promise<void> {
  const { app, ttys } = await identifyTerminal(pid)
  const dir = projectPath || (await resolveProcessCwd(pid))
  const escapedDir = dir.replace(/'/g, "'\\''")

  switch (app) {
    case 'terminal':
      if (await focusTerminalTab(ttys)) return
      break
    case 'iterm':
      if (await focusITermTab(ttys)) return
      try {
        await runAppleScript(
          'tell application "iTerm2"',
          '  tell current window',
          '    create tab with default profile',
          `    tell current session of current tab to write text "cd '${escapedDir}'"`,
          '  end tell',
          '  activate',
          'end tell'
        )
      } catch {
        await execFileAsync('open', ['-a', 'iTerm2', dir]).catch(() =>
          execFileAsync('open', ['-a', 'iTerm', dir]).catch(() => {})
        )
      }
      return
    case 'cursor':
      if (await focusApp('Cursor')) return
      break
    case 'vscode':
      if (await focusApp('Visual Studio Code')) return
      break
    case 'warp': {
      const opened = await openWarpTabAtDirectory(dir)
      if (opened) {
        void focusApp('Warp').catch(() => focusApp('Warp Preview'))
        return
      }
      break
    }
  }

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
): Promise<{ success: boolean; error?: string; hint?: string }> {
  const { app: termApp, ttys } = await identifyTerminal(pid)
  const fullCommand = await getFullCommand(pid)
  if (!fullCommand) {
    return { success: false, error: 'Could not determine process command' }
  }

  const cwd = projectPath || (await resolveProcessCwd(pid))

  const killed = await killProcess(pid)
  if (!killed) {
    return { success: false, error: 'Failed to kill the process' }
  }

  await new Promise((r) => setTimeout(r, 450))

  switch (termApp) {
    case 'terminal':
      if (await runCommandInTerminalTab(ttys, cwd, fullCommand)) {
        return { success: true }
      }
      break
    case 'iterm':
      if (await runCommandInITermTab(ttys, cwd, fullCommand)) {
        return { success: true }
      }
      break
    case 'warp': {
      const ok = await openWarpTabAtDirectory(cwd)
      if (ok) {
        void focusApp('Warp').catch(() => focusApp('Warp Preview'))
        return {
          success: true,
          hint: 'Warp: new tab opened — press ↑ for history or run your dev command again.'
        }
      }
      break
    }
    case 'cursor':
      await focusApp('Cursor')
      return {
        success: true,
        hint: 'Cursor focused — re-run the command in the integrated terminal (↑ for history).'
      }
    case 'vscode':
      await focusApp('Visual Studio Code')
      return {
        success: true,
        hint: 'VS Code focused — re-run the command in the integrated terminal (↑ for history).'
      }
    default:
      break
  }

  const escapedCwd = cwd.replace(/'/g, "'\\''")
  const escapedCmd = fullCommand.replace(/'/g, "'\\''")
  execFileAsync('/usr/bin/osascript', [
    '-e', 'tell application "Terminal"',
    '-e', '  activate',
    '-e', `  do script "cd '${escapedCwd}' && ${escapedCmd}"`,
    '-e', 'end tell'
  ]).catch(() => {})

  return {
    success: true,
    hint: 'Launched in Terminal.app (could not match the original terminal tab).'
  }
}
