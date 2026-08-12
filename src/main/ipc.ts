import { ipcMain, BrowserWindow, globalShortcut, app } from 'electron'
import log from './logger'
import { loadProfilesState, saveProfilesState } from './profiles-persistence'
import { scanPorts } from './services/port-scanner'
import {
  getProcessDetails,
  killProcess,
  killProcesses,
  openInBrowser,
  openInTerminal,
  openInVSCode,
  restartProcess,
  setAutoFocusTerminal
} from './services/process-manager'
import { markExpectedStopsForPid } from './services/expected-stops'
import {
  processPortAlerts,
  updateAlertSettings
} from './services/port-alerts'
import type { PortInfo, ProfilesPersistState, Profile } from '../shared/types'
import { registerWorkbenchIpc } from './modules/workbench-ipc'

function markStopsForPid(pid: number): void {
  markExpectedStopsForPid(pid, lastPorts)
}

export function notifyProfilesChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      if (!w.isDestroyed()) w.webContents.send('profiles-changed')
    } catch {
      /* ignore */
    }
  }
  // Tray/dock menus cache a signature — rebuild so "Add to profiles" stays current.
  try {
    // Lazy require avoids a circular import with tray.ts
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { refreshTrayMenus } = require('./tray') as {
      refreshTrayMenus: () => void
    }
    refreshTrayMenus()
  } catch {
    /* tray may not be ready yet */
  }
}

let pollingTimeout: ReturnType<typeof setTimeout> | null = null
let lastPorts: PortInfo[] = []
let scanning = false
let portChangeListeners: Array<(ports: PortInfo[]) => void> = []

export function getLastPorts(): PortInfo[] {
  return lastPorts
}

export function onPortsChanged(listener: (ports: PortInfo[]) => void): () => void {
  portChangeListeners.push(listener)
  return () => {
    portChangeListeners = portChangeListeners.filter((l) => l !== listener)
  }
}

function validatePid(pid: unknown): pid is number {
  return typeof pid === 'number' && Number.isInteger(pid) && pid > 0
}

function validatePort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port > 0 && port <= 65535
}

let currentShortcutCallback: (() => void) | null = null
let registeredShortcut: string | null = null

export function setShortcutCallback(callback: () => void): void {
  currentShortcutCallback = callback
}

export function getRegisteredShortcut(): string | null {
  return registeredShortcut
}

export function updateGlobalShortcut(shortcut: string): boolean {
  if (shortcut === registeredShortcut) return true
  const invoke = () => {
    if (currentShortcutCallback) currentShortcutCallback()
  }
  // Register the new accelerator BEFORE dropping the old one, so a failed
  // registration (invalid or taken by another app) leaves the old shortcut
  // working instead of unregistering everything.
  try {
    if (!globalShortcut.register(shortcut, invoke)) return false
  } catch {
    return false
  }
  if (registeredShortcut) {
    try {
      globalShortcut.unregister(registeredShortcut)
    } catch {
      /* ignore */
    }
  }
  registeredShortcut = shortcut
  return true
}

interface SafetySettings {
  protectSystemPorts: boolean
  confirmDestructive: boolean
  autoFocusTerminal: boolean
}

let safetySettings: SafetySettings = {
  protectSystemPorts: true,
  confirmDestructive: true,
  autoFocusTerminal: true
}

export function getSafetySettings(): SafetySettings {
  return safetySettings
}

/** A pid is protected when it owns a port the scanner flagged as critical. */
export function isProtectedPid(pid: number): boolean {
  if (!safetySettings.protectSystemPorts) return false
  return lastPorts.some((p) => p.pid === pid && p.isCritical)
}

export function registerIpcHandlers(): void {
  ipcMain.handle('get-ports', async () => {
    lastPorts = await scanPorts()
    return lastPorts
  })

  ipcMain.handle('get-process-details', async (_event, pid: number) => {
    if (!validatePid(pid)) return null
    return getProcessDetails(pid)
  })

  ipcMain.handle('kill-process', async (_event, pid: number, force?: boolean) => {
    if (!validatePid(pid)) return false
    if (isProtectedPid(pid)) {
      log.warn(`Refused to kill protected system process pid=${pid}`)
      return false
    }
    markStopsForPid(pid)
    return killProcess(pid, force)
  })

  ipcMain.handle('kill-processes', async (_event, pids: number[]) => {
    if (!Array.isArray(pids) || !pids.every(validatePid)) return []
    const allowed = pids.filter((pid) => !isProtectedPid(pid))
    for (const pid of allowed) markStopsForPid(pid)
    return killProcesses(allowed)
  })

  ipcMain.handle('open-in-browser', async (_event, port: number) => {
    if (!validatePort(port)) return
    openInBrowser(port)
  })

  ipcMain.handle('open-in-terminal', async (_event, pid: number, projectPath?: string) => {
    if (!validatePid(pid)) return
    return openInTerminal(pid, typeof projectPath === 'string' ? projectPath : undefined)
  })

  ipcMain.handle('open-in-vscode', async (_event, pid: number, projectPath?: string) => {
    if (!validatePid(pid)) return
    return openInVSCode(pid, typeof projectPath === 'string' ? projectPath : undefined)
  })

  ipcMain.handle('restart-process', async (_event, pid: number, projectPath?: string) => {
    if (!validatePid(pid)) return { success: false, error: 'Invalid PID' }
    if (isProtectedPid(pid)) {
      log.warn(`Refused to restart protected system process pid=${pid}`)
      return { success: false, error: 'This is a protected system process.' }
    }
    markStopsForPid(pid)
    return restartProcess(pid, typeof projectPath === 'string' ? projectPath : undefined)
  })

  ipcMain.handle('update-alert-settings', async (_event, settings: unknown) => {
    if (!settings || typeof settings !== 'object') return
    const s = settings as Partial<{
      notifyPortChange: boolean
      notifyCrash: boolean
      autoOpenBrowser: boolean
    }>
    updateAlertSettings(s)
  })

  ipcMain.handle('update-poll-interval', async (_event, intervalMs: number) => {
    // NaN slips past a plain `< 1000` comparison and would busy-loop the poller
    if (typeof intervalMs !== 'number' || !Number.isFinite(intervalMs)) return
    currentIntervalMs = Math.min(30000, Math.max(1000, Math.round(intervalMs)))
  })

  ipcMain.handle('update-global-shortcut', async (_event, shortcut: string) => {
    if (typeof shortcut !== 'string' || shortcut.length === 0 || shortcut.length > 100) {
      return false
    }
    return updateGlobalShortcut(shortcut)
  })

  ipcMain.handle('update-safety-settings', async (_event, settings: unknown) => {
    if (!settings || typeof settings !== 'object') return
    const s = settings as Partial<SafetySettings>
    safetySettings = {
      protectSystemPorts:
        typeof s.protectSystemPorts === 'boolean'
          ? s.protectSystemPorts
          : safetySettings.protectSystemPorts,
      confirmDestructive:
        typeof s.confirmDestructive === 'boolean'
          ? s.confirmDestructive
          : safetySettings.confirmDestructive,
      autoFocusTerminal:
        typeof s.autoFocusTerminal === 'boolean'
          ? s.autoFocusTerminal
          : safetySettings.autoFocusTerminal
    }
    setAutoFocusTerminal(safetySettings.autoFocusTerminal)
  })

  ipcMain.handle('get-app-version', async () => app.getVersion())

  ipcMain.handle('window-is-full-screen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? win.isFullScreen() : false
  })

  ipcMain.handle('window-set-full-screen', (event, flag: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    win.setFullScreen(Boolean(flag))
    return win.isFullScreen()
  })

  ipcMain.handle('window-toggle-full-screen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    win.setFullScreen(!win.isFullScreen())
    return win.isFullScreen()
  })

  ipcMain.handle('load-profiles', async () => loadProfilesState())

  ipcMain.handle('save-profiles', async (_event, state: unknown) => {
    if (!state || typeof state !== 'object') return false
    const s = state as Partial<ProfilesPersistState>
    if (!Array.isArray(s.profiles)) return false
    const profiles = s.profiles.filter((p): p is Profile => {
      return (
        p != null &&
        typeof p === 'object' &&
        typeof (p as Profile).id === 'string' &&
        typeof (p as Profile).name === 'string' &&
        Array.isArray((p as Profile).favoritePorts)
      )
    })
    saveProfilesState({
      profiles,
      activeProfileId:
        typeof s.activeProfileId === 'string' ? s.activeProfileId : null
    })
    notifyProfilesChanged()
    return true
  })

  registerWorkbenchIpc()
}

let currentIntervalMs = 3000

export function startPortPolling(window: BrowserWindow, intervalMs = 3000): void {
  currentIntervalMs = intervalMs
  stopPortPolling()

  // Refresh the renderer as soon as it becomes visible again — updates are
  // skipped while hidden, so without this the UI would show stale data for
  // up to a full (hidden) poll cycle.
  window.on('show', () => {
    if (!window.isDestroyed()) {
      window.webContents.send('ports-updated', lastPorts)
    }
  })

  async function poll(): Promise<void> {
    const visible = !window.isDestroyed() && window.isVisible()
    // Hidden windows don't need live data; poll slowly just to keep the
    // tray menu fresh instead of running lsof every few seconds forever.
    const effectiveInterval = visible
      ? currentIntervalMs
      : Math.max(currentIntervalMs, 10000)

    if (scanning) {
      pollingTimeout = setTimeout(poll, effectiveInterval)
      return
    }
    scanning = true
    try {
      const ports = await scanPorts()
      lastPorts = ports
      // Alerts run even when hidden so crash OS notifications still fire.
      processPortAlerts(window.isDestroyed() ? null : window, ports)
      if (visible && !window.isDestroyed()) {
        window.webContents.send('ports-updated', ports)
      }
      for (const listener of portChangeListeners) {
        try { listener(ports) } catch { /* listener errors are non-fatal */ }
      }
    } catch (err) {
      log.warn('Port scan error:', err)
    } finally {
      scanning = false
    }
    pollingTimeout = setTimeout(poll, effectiveInterval)
  }

  pollingTimeout = setTimeout(poll, 0)
}

export function stopPortPolling(): void {
  if (pollingTimeout) {
    clearTimeout(pollingTimeout)
    pollingTimeout = null
  }
}
