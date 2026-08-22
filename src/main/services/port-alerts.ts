import type { BrowserWindow } from 'electron'
import type { AlertSettings, PortInfo } from '../../shared/types'
import { isSystemProcess } from '../../shared/system-process'
import { deliverAlert } from './notifications'
import { consumeExpectedStop } from './expected-stops'
import { openInBrowser } from './process-manager'

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  notifyPortChange: true,
  notifyCrash: true,
  autoOpenBrowser: false
}

let alertSettings: AlertSettings = { ...DEFAULT_ALERT_SETTINGS }
let baselineReady = false
let prevByPort = new Map<number, PortInfo>()
const recentCrashAlertAt = new Map<number, number>()

const CRASH_DEDUP_MS = 60_000

/** macOS helpers that open random high ports — not worth crash spam. */
function isNoiseProcess(p: PortInfo): boolean {
  return isSystemProcess(p)
}

export function updateAlertSettings(partial: Partial<AlertSettings>): void {
  alertSettings = {
    notifyPortChange:
      typeof partial.notifyPortChange === 'boolean'
        ? partial.notifyPortChange
        : alertSettings.notifyPortChange,
    notifyCrash:
      typeof partial.notifyCrash === 'boolean'
        ? partial.notifyCrash
        : alertSettings.notifyCrash,
    autoOpenBrowser:
      typeof partial.autoOpenBrowser === 'boolean'
        ? partial.autoOpenBrowser
        : alertSettings.autoOpenBrowser
  }
}

function labelFor(p: PortInfo): string {
  return p.projectName || p.command || 'Process'
}

export function processPortAlerts(
  window: BrowserWindow | null,
  ports: PortInfo[]
): void {
  const current = new Map<number, PortInfo>()
  for (const p of ports) {
    if (p.role === 'connection') continue
    // Prefer the first TCP-ish entry per port number for messaging
    if (!current.has(p.port)) current.set(p.port, p)
  }

  if (!baselineReady) {
    prevByPort = current
    baselineReady = true
    return
  }

  const { notifyPortChange, notifyCrash, autoOpenBrowser } = alertSettings
  const now = Date.now()

  for (const [port, info] of current) {
    if (!prevByPort.has(port)) {
      if (notifyPortChange && !isNoiseProcess(info)) {
        deliverAlert(window, {
          type: 'info',
          title: 'Port Started',
          message: `${labelFor(info)} on :${port}`
        })
        if (autoOpenBrowser) {
          void openInBrowser(port)
        }
      }
    }
  }

  for (const [port, prev] of prevByPort) {
    if (current.has(port)) continue

    const expected = consumeExpectedStop(port, prev.pid)
    if (expected) continue
    if (isNoiseProcess(prev)) continue

    if (notifyCrash) {
      const last = recentCrashAlertAt.get(port) || 0
      if (now - last < CRASH_DEDUP_MS) continue
      recentCrashAlertAt.set(port, now)
      for (const [p, at] of recentCrashAlertAt) {
        if (now - at >= CRASH_DEDUP_MS) recentCrashAlertAt.delete(p)
      }

      deliverAlert(window, {
        type: 'warning',
        title: 'Process disappeared',
        message: `${labelFor(prev)} on :${port} is no longer listening`
      })
      continue
    }

    if (notifyPortChange) {
      deliverAlert(window, {
        type: 'warning',
        title: 'Port Stopped',
        message: `Port :${port} is no longer listening`
      })
    }
  }

  prevByPort = current
}
