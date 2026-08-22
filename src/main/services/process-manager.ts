import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { openExternal } from '../os/shell'
import { execFileSafe } from '../os/exec-file-safe'
import type { ProcessDetails } from '../../shared/types'

const execFileAsync = promisify(execFile)

/** When false, restart still runs in the original tab but does not steal focus. */
let autoFocusTerminal = true

export function setAutoFocusTerminal(enabled: boolean): void {
  autoFocusTerminal = enabled
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
      'pid=,ppid=,%cpu=,%mem=,rss=,etime=,user=,command='
    ])

    const line = stdout.trim()
    if (!line) return null

    const parts = line.trim().split(/\s+/)
    if (parts.length < 8) return null

    const fullCommand = parts.slice(7).join(' ')

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
      ppid: parseInt(parts[1], 10) || 0,
      cpu: parseFloat(parts[2]) || 0,
      memory: parseFloat(parts[3]) || 0,
      memoryRSS: parseInt(parts[4], 10) || 0,
      uptime: parts[5],
      user: parts[6],
      command: fullCommand.split('/').pop()?.split(' ')[0] || fullCommand,
      fullCommand,
      children,
      ports: [...new Set(ports)]
    }
  } catch {
    return null
  }
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
  void openExternal(`http://localhost:${port}`)
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

export interface TerminalOpenResult {
  ok: boolean
  method: 'focused-tab' | 'focused-app' | 'new-tab' | 'fallback' | 'failed'
  app: TerminalApp
  message: string
}

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
  ['contents/macos/stable', 'warp'],
  ['warphelper', 'warp']
]

function addProcessTty(ttys: Set<string>, raw: string): void {
  const t = raw.trim()
  if (!t || t === '??' || t === '?' || t === '') return
  const withDev = t.startsWith('/dev/') ? t : `/dev/${t}`
  ttys.add(withDev)
  // Terminal/iTerm AppleScript sometimes expose tty without the /dev/ prefix
  ttys.add(withDev.replace(/^\/dev\//, ''))
}

async function collectTtysFromLsof(pid: number, ttys: Set<string>): Promise<void> {
  const { stdout: lsofOut } = await execFileSafe('lsof', [
    '-a',
    '-p',
    String(pid),
    '-d',
    '0,1,2',
    '-Fn'
  ])
  for (const line of lsofOut.split('\n')) {
    if (line.startsWith('n/dev/tty') || line.startsWith('n/dev/ttys')) {
      addProcessTty(ttys, line.slice(1).split('\0')[0])
    }
  }
}

async function collectTtysForPid(pid: number): Promise<Set<string>> {
  const ttys = new Set<string>()
  if (!isValidPid(pid)) return ttys

  const { stdout: leafTty } = await execFileSafe('ps', ['-p', String(pid), '-o', 'tty='])
  addProcessTty(ttys, leafTty)
  await collectTtysFromLsof(pid, ttys)

  // Process group often still holds the shell TTY when the leaf shows ??
  const { stdout: pgidOut } = await execFileSafe('ps', ['-p', String(pid), '-o', 'pgid='])
  const pgid = parseInt(pgidOut.trim(), 10)
  if (!isNaN(pgid) && pgid > 0) {
    const { stdout: groupTtys } = await execFileSafe('ps', ['-o', 'tty=', '-g', String(pgid)])
    for (const row of groupTtys.split('\n')) addProcessTty(ttys, row)
  }

  // Walk parents — the shell that owns the pty is often an ancestor of node
  let current = pid
  for (let depth = 0; depth < 16 && current > 1; depth++) {
    const { stdout } = await execFileSafe('ps', ['-p', String(current), '-o', 'ppid=,tty='])
    const m = stdout.trim().match(/^(\d+)\s+(\S+)/)
    if (!m) break
    addProcessTty(ttys, m[2])
    await collectTtysFromLsof(current, ttys)
    const next = parseInt(m[1], 10)
    if (isNaN(next) || next <= 1 || next === current) break
    current = next
  }

  // Direct children (shell → node) may own the pty
  const { stdout: kids } = await execFileSafe('pgrep', ['-P', String(pid)])
  for (const kid of kids.trim().split('\n').filter(Boolean).slice(0, 12)) {
    const kidPid = parseInt(kid, 10)
    if (isNaN(kidPid)) continue
    const { stdout: kidTty } = await execFileSafe('ps', ['-p', kid, '-o', 'tty='])
    addProcessTty(ttys, kidTty)
    await collectTtysFromLsof(kidPid, ttys)
  }

  return ttys
}

async function identifyTerminal(pid: number): Promise<AncestorInfo> {
  const ttys = await collectTtysForPid(pid)
  let app: TerminalApp = 'unknown'

  if (!isValidPid(pid)) return { app, ttys: [] }

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
    if (/TERM_PROGRAM=warp/i.test(psEnv) || /WARPPATH=/i.test(psEnv)) {
      app = 'warp'
    } else if (/TERM_PROGRAM=vscode/i.test(psEnv) && /CURSOR/i.test(psEnv)) {
      app = 'cursor'
    } else if (/TERM_PROGRAM=vscode/i.test(psEnv)) {
      app = 'vscode'
    } else if (/TERM_PROGRAM=apple_terminal/i.test(psEnv)) {
      app = 'terminal'
    } else if (/TERM_PROGRAM=iterm/i.test(psEnv)) {
      app = 'iterm'
    }
  }

  return { app, ttys: [...ttys] }
}

async function runAppleScript(...lines: string[]): Promise<string> {
  const args = lines.flatMap((l) => ['-e', l])
  const { stdout } = await execFileAsync('/usr/bin/osascript', args)
  return stdout.trim()
}

function ttyMatchConditions(ttys: string[], sessionVar: string): string {
  // Match both /dev/ttys001 and ttys001 forms
  const variants = new Set<string>()
  for (const t of ttys) {
    variants.add(t)
    if (t.startsWith('/dev/')) variants.add(t.slice(5))
    else variants.add(`/dev/${t}`)
  }
  return [...variants]
    .map((t) => `tty of ${sessionVar} is "${asQuote(t)}"`)
    .join(' or ')
}

async function focusTerminalTab(ttys: string[]): Promise<boolean> {
  if (ttys.length === 0) return false

  try {
    const conditions = ttyMatchConditions(ttys, 't')
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
    const conditions = ttyMatchConditions(ttys, 's')
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

/** Prefer focusing the live tab; Terminal + iTerm both expose tty for matching. */
async function focusAnyScriptableTab(ttys: string[]): Promise<TerminalApp | null> {
  if (ttys.length === 0) return null
  if (await focusTerminalTab(ttys)) return 'terminal'
  if (await focusITermTab(ttys)) return 'iterm'
  return null
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
    await openExternal(uris[0])
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
        ...(autoFocusTerminal ? ['        activate'] : []),
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
          ...(autoFocusTerminal ? ['          activate'] : []),
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

export async function openInTerminal(
  pid: number,
  projectPath?: string
): Promise<TerminalOpenResult> {
  const { app, ttys } = await identifyTerminal(pid)
  const dir = projectPath || (await resolveProcessCwd(pid))

  // Always try exact tab match first when we have a TTY (works across Terminal/iTerm
  // even if ancestor detection mis-labels the host app).
  const focused = await focusAnyScriptableTab(ttys)
  if (focused) {
    return {
      ok: true,
      method: 'focused-tab',
      app: focused,
      message: `Focused the live ${focused === 'iterm' ? 'iTerm' : 'Terminal'} tab for this process.`
    }
  }

  // IDE / Warp integrated sessions are not scriptable by tty — focus the host app
  // and stop. Never fall through to `do script` (that opens a brand-new Terminal).
  switch (app) {
    case 'cursor':
      if (await focusApp('Cursor')) {
        return {
          ok: true,
          method: 'focused-app',
          app: 'cursor',
          message:
            'Focused Cursor. Integrated terminals are not scriptable — switch to the panel where this process is running (⌃`).'
        }
      }
      return {
        ok: false,
        method: 'failed',
        app: 'cursor',
        message: 'Could not focus Cursor for this process.'
      }
    case 'vscode':
      if (await focusApp('Visual Studio Code')) {
        return {
          ok: true,
          method: 'focused-app',
          app: 'vscode',
          message:
            'Focused VS Code. Integrated terminals are not scriptable — switch to the panel where this process is running (⌃`).'
        }
      }
      return {
        ok: false,
        method: 'failed',
        app: 'vscode',
        message: 'Could not focus VS Code for this process.'
      }
    case 'warp':
      if ((await focusApp('Warp')) || (await focusApp('Warp Preview'))) {
        return {
          ok: true,
          method: 'focused-app',
          app: 'warp',
          message:
            'Focused Warp. Warp does not expose session APIs — pick the tab that is already running this process.'
        }
      }
      return {
        ok: false,
        method: 'failed',
        app: 'warp',
        message: 'Could not focus Warp for this process.'
      }
    case 'terminal': {
      // Bring Terminal forward without spawning a new tab when we couldn't match tty
      // (Automation permission denied, or tty race). Prefer focus over `do script`.
      if (await focusApp('Terminal')) {
        return {
          ok: true,
          method: 'focused-app',
          app: 'terminal',
          message:
            'Focused Terminal but could not match the exact tab. Select the tab already running this process.'
        }
      }
      break
    }
    case 'iterm': {
      if ((await focusApp('iTerm2')) || (await focusApp('iTerm'))) {
        return {
          ok: true,
          method: 'focused-app',
          app: 'iterm',
          message:
            'Focused iTerm but could not match the exact session. Select the tab already running this process.'
        }
      }
      break
    }
  }

  // Unknown host and no tty match — only then open a fresh Terminal at cwd
  try {
    await execFileAsync('/usr/bin/osascript', [
      '-e',
      'tell application "Terminal"',
      '-e',
      '  activate',
      '-e',
      `  do script "${asQuote(`cd ${shQuote(dir)}`)}"`,
      '-e',
      'end tell'
    ])
    return {
      ok: true,
      method: 'fallback',
      app: 'terminal',
      message:
        'No attachable tty found for this process — opened a new Terminal at the project folder.'
    }
  } catch {
    return {
      ok: false,
      method: 'failed',
      app,
      message: 'Could not open or focus a terminal for this process.'
    }
  }
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
        if (autoFocusTerminal) {
          void focusApp('Warp').catch(() => focusApp('Warp Preview'))
        }
        return {
          success: true,
          hint: 'Warp: new tab opened — press ↑ for history or run your dev command again.'
        }
      }
      break
    }
    case 'cursor':
      if (autoFocusTerminal) await focusApp('Cursor')
      return {
        success: true,
        hint: autoFocusTerminal
          ? 'Cursor focused — re-run the command in the integrated terminal (↑ for history).'
          : 'Restarted. Re-run the command in Cursor’s integrated terminal (↑ for history).'
      }
    case 'vscode':
      if (autoFocusTerminal) await focusApp('Visual Studio Code')
      return {
        success: true,
        hint: autoFocusTerminal
          ? 'VS Code focused — re-run the command in the integrated terminal (↑ for history).'
          : 'Restarted. Re-run the command in VS Code’s integrated terminal (↑ for history).'
      }
    default:
      break
  }

  // Fallback: run via a temp script so the user's command never has to
  // survive AppleScript string quoting (quotes/backslashes broke this).
  const sp = writeRestartShellScript(cwd, fullCommand)
  const esc = asQuote(sp)
  const fallbackLines = [
    'tell application "Terminal"',
    ...(autoFocusTerminal ? ['  activate'] : []),
    `  do script "exec /bin/bash \\"${esc}\\""`,
    'end tell'
  ]
  execFileAsync(
    '/usr/bin/osascript',
    fallbackLines.flatMap((l) => ['-e', l])
  )
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
