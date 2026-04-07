import { ipcMain, BrowserWindow } from 'electron'
import log from './logger'
import { scanPorts } from './services/port-scanner'
import {
  getProcessDetails,
  killProcess,
  killProcesses,
  openInBrowser,
  openInTerminal,
  openInVSCode,
  restartProcess,
  getProcessLogs
} from './services/process-manager'
import type { PortInfo } from '../shared/types'

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

export function setShortcutCallback(callback: () => void): void {
  currentShortcutCallback = callback
}

export function updateGlobalShortcut(shortcut: string): boolean {
  const { globalShortcut } = require('electron')
  globalShortcut.unregisterAll()
  const invoke = () => {
    if (currentShortcutCallback) currentShortcutCallback()
  }
  try {
    const ok = globalShortcut.register(shortcut, invoke)
    if (ok) return true
  } catch {
    /* invalid accelerator may throw in some Electron versions */
  }
  globalShortcut.register('CommandOrControl+Shift+P', invoke)
  return false
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

  ipcMain.handle('get-process-logs', async (_event, pid: number) => {
    if (!validatePid(pid)) return []
    return getProcessLogs(pid)
  })

  ipcMain.handle('kill-process', async (_event, pid: number, force?: boolean) => {
    if (!validatePid(pid)) return false
    return killProcess(pid, force)
  })

  ipcMain.handle('kill-processes', async (_event, pids: number[]) => {
    if (!Array.isArray(pids) || !pids.every(validatePid)) return []
    return killProcesses(pids)
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
    return restartProcess(pid, typeof projectPath === 'string' ? projectPath : undefined)
  })

  ipcMain.handle('update-poll-interval', async (_event, intervalMs: number) => {
    if (typeof intervalMs !== 'number' || intervalMs < 1000 || intervalMs > 30000) return
    currentIntervalMs = intervalMs
  })

  ipcMain.handle('update-global-shortcut', async (_event, shortcut: string) => {
    if (typeof shortcut !== 'string' || shortcut.length === 0) return false
    return updateGlobalShortcut(shortcut)
  })
}

let currentIntervalMs = 3000

export function startPortPolling(window: BrowserWindow, intervalMs = 3000): void {
  currentIntervalMs = intervalMs
  stopPortPolling()

  async function poll(): Promise<void> {
    if (scanning) {
      pollingTimeout = setTimeout(poll, currentIntervalMs)
      return
    }
    scanning = true
    try {
      const ports = await scanPorts()
      lastPorts = ports
      if (!window.isDestroyed()) {
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
    pollingTimeout = setTimeout(poll, currentIntervalMs)
  }

  pollingTimeout = setTimeout(poll, 0)
}

export function stopPortPolling(): void {
  if (pollingTimeout) {
    clearTimeout(pollingTimeout)
    pollingTimeout = null
  }
}
