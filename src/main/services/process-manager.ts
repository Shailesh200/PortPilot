import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { shell } from 'electron'
import type { ProcessDetails } from '../../shared/types'

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

function isValidPid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0
}

/** POSIX single-quote escaping — safe for embedding in shell commands. */
function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/** Escape a string for embedding inside an AppleScript "..." literal. */
function asQuote(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function getProcessDetails(pid: number): Promise<ProcessDetails | null> {
  if (!isValidPid(pid)) return null
  try {
    const { stdout } = await execFileSafe('ps', [
      '-p',
      String(pid),
      '-o',
      'pid=,%cpu=,%mem=,rss=,etime=,user=,command='
    ])

    const line = stdout.trim()
    if (!line) return null

    const parts = line.trim().split(/\s+/)
    if (parts.length < 7) return null

    const fullCommand = parts.slice(6).join(' ')

    const { stdout: childrenOut } = await execFileSafe('pgrep', ['-P', String(pid)])
    const children = childrenOut
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n))

    const { stdout: portsOut } = await execFileSafe('lsof', [
      '-p',
      String(pid),
      '-iTCP',
      '-sTCP:LISTEN',
      '-P',
      '-n'
    ])
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
  if (!isValidPid(pid)) return ['Invalid process id.']
  const lines: string[] = []
  const logFiles = new Set<string>()

  const cwd = await resolveProcessCwd(pid)

  const { stdout: fnOut } = await execFileSafe('lsof', ['-p', String(pid), '-Fn'])
  for (const line of fnOut.split('\n')) {
    if (line.startsWith('n/')) {
      const filePath = line.slice(1).split('\0')[0]
      if (!filePath.startsWith('/')) continue
      if (isNoisePath(filePath)) continue
      if (filePath.length > 4096) continue
      logFiles.add(filePath)
    }
  }

  const { stdout: findOut } = await execFileSafe('find', [
    cwd,
    '-maxdepth',
    '5',
    '(',
    '-name',
    '*.log',
    '-o',
    '-name',
    'npm-debug.log*',
    '-o',
    '-name',
    'yarn-debug.log*',
    '-o',
    '-name',
    'vite.config.*.timestamp-*',
    ')',
    '-type',
    'f',
    '-mmin',
    '-720'
  ])
  for (const p of findOut.trim().split('\n').slice(0, 25)) {
    if (p && p.startsWith('/') && !isNoisePath(p)) logFiles.add(p)
  }

  const ranked = [...logFiles].sort(
    (a, b) => scoreLogPath(b) - scoreLogPath(a) || b.length - a.length
  )

  for (const logFile of ranked.slice(0, 6)) {
    // execFile: the path is passed as an argv entry, never through a shell,
    // so hostile filenames can't inject commands.
    const { stdout: tail } = await execFileSafe('tail', ['-n', '80', logFile])
    if (tail.trim()) {
      lines.push(`--- ${logFile} ---`)
      lines.push(...tail.trim().split('\n'))
    }
  }

  if (lines.length === 0 && process.platform === 'darwin') {
    const { stdout: syslog } = await execFileSafe('log', [
      'show',
      '--predicate',
      `processID == ${pid}`,
      '--last',
      '5m',
      '--style',
      'syslog'
    ])
    const tailLines = syslog.trim().split('\n').filter(Boolean).slice(-40)
    if (tailLines.length > 0) {
      lines.push('--- System Log (last 5m) ---')
      lines.push(...tailLines)
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

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM means the process exists but belongs to another user
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!processExists(pid)) return true
    await new Promise((r) => setTimeout(r, 50))
  }
  return !processExists(pid)
}

export async function killProcess(pid: number, force = false): Promise<boolean> {
  if (!isValidPid(pid)) return false
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')
    return true
  } catch (err) {
    // ESRCH: already gone — treat as success. EPERM: real failure.
    return (err as NodeJS.ErrnoException).code === 'ESRCH'
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
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return
  shell.openExternal(`http://localhost:${port}`)
}

async function resolveProcessCwd(pid: number): Promise<string> {
  if (!isValidPid(pid)) return process.env.HOME || '~'
  const { stdout } = await execFileSafe('lsof', [
    '-a',
    '-p',
    String(pid),
    '-d',
    'cwd',
    '-Fn'
  ])
  for (const line of stdout.trim().split('\n')) {
    if (line.startsWith('n') && line.length > 2 && line[1] === '/') {
      return line.slice(1)
    }
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

  if (!isValidPid(pid)) return { app, ttys: [] }

  const { stdout: leafTty } = await execFileSafe('ps', ['-p', String(pid), '-o', 'tty='])
  addProcessTty(ttys, leafTty)

  let current = pid
  for (let depth = 0; depth < 30 && current > 1; depth++) {
    const { stdout } = await execFileSafe('ps', [
      '-p',
      String(current),
      '-o',
      'ppid=,tty=,command='
    ])
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

    const next = parseInt(ppidMatch[1], 10)
    if (isNaN(next)) break
    current = next
  }

  if (app === 'unknown') {
    const { stdout: psEnv } = await execFileSafe('ps', ['eww', '-p', String(pid)])
    if (/TERM_PROGRAM=warp/i.test(psEnv)) {
      app = 'warp'
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
    const conditions = ttys.map((t) => `tty of t is "${asQuote(t)}"`).join(' or ')
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
    const conditions = ttys.map((t) => `tty of s is "${asQuote(t)}"`).join(' or ')
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
      `tell application "${asQuote(bundleName)}"`,
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
cd ${shQuote(cwd)}
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
  const conditions = ttys.map((t) => `tty of t is "${asQuote(t)}"`).join(' or ')
  const esc = asQuote(sp)
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
  const conditions = ttys.map((t) => `tty of s is "${asQuote(t)}"`).join(' or ')
  const esc = asQuote(sp)
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
          `    tell current session of current tab to write text "${asQuote(`cd ${shQuote(dir)}`)}"`,
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
    '-e', `  do script "${asQuote(`cd ${shQuote(dir)}`)}"`,
    '-e', 'end tell'
  ]).catch(() => {})
}

export async function openInVSCode(pid: number, projectPath?: string): Promise<void> {
  const dir = projectPath || (await resolveProcessCwd(pid))

  try {
    await execFileAsync('open', ['-a', 'Cursor', dir])
    return
  } catch {
    // Cursor not installed
  }

  try {
    await execFileAsync('open', ['-a', 'Visual Studio Code', dir])
    return
  } catch {
    // VS Code not installed
  }

  const extendedPath = `/usr/local/bin:/opt/homebrew/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ''}`
  spawn('code', [dir], { shell: true, env: { ...process.env, PATH: extendedPath } })
}

async function getFullCommand(pid: number): Promise<string | null> {
  if (!isValidPid(pid)) return null
  const { stdout } = await execFileSafe('ps', ['-p', String(pid), '-o', 'command='])
  const cmd = stdout.trim()
  return cmd || null
}

export async function restartProcess(
  pid: number,
  projectPath?: string
): Promise<{ success: boolean; error?: string; hint?: string }> {
  if (!isValidPid(pid)) {
    return { success: false, error: 'Invalid process id' }
  }

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

  // Wait for the process to actually exit instead of a fixed sleep — a
  // slow shutdown otherwise restarts the command while the old process
  // still holds the port.
  const exited = await waitForExit(pid, 3000)
  if (!exited) {
    // Still alive after SIGTERM: escalate explicitly, then wait again.
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
    if (!(await waitForExit(pid, 2000))) {
      return {
        success: false,
        error: 'Process did not exit after SIGKILL — not restarting to avoid a duplicate.'
      }
    }
  }

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

  // Fallback: run via a temp script so the user's command never has to
  // survive AppleScript string quoting (quotes/backslashes broke this).
  const sp = writeRestartShellScript(cwd, fullCommand)
  const esc = asQuote(sp)
  execFileAsync('/usr/bin/osascript', [
    '-e', 'tell application "Terminal"',
    '-e', '  activate',
    '-e', `  do script "exec /bin/bash \\"${esc}\\""`,
    '-e', 'end tell'
  ])
    .then(() => scheduleDeleteScript(sp))
    .catch(() => {
      try {
        unlinkSync(sp)
      } catch {
        /* ignore */
      }
    })

  return {
    success: true,
    hint: 'Launched in Terminal.app (could not match the original terminal tab).'
  }
}
