import { Notification, BrowserWindow } from 'electron'
import log from '../logger'

export interface AppToastPayload {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
}

let onNotificationClick: (() => void) | null = null

export function setNotificationClickHandler(handler: () => void): void {
  onNotificationClick = handler
}

export function showNativeNotification(title: string, body: string): void {
  if (!Notification.isSupported()) {
    log.warn('Native notifications are not supported on this platform')
    return
  }
  try {
    const notification = new Notification({
      title,
      body,
      silent: false
    })
    notification.on('click', () => {
      onNotificationClick?.()
    })
    notification.show()
  } catch (err) {
    log.warn('Failed to show native notification:', err)
  }
}

/**
 * Foreground (visible + focused): in-app toast only.
 * Background: macOS/Windows notification; also toast if the window still exists.
 */
export function deliverAlert(
  window: BrowserWindow | null,
  toast: AppToastPayload,
  opts?: { forceNative?: boolean }
): void {
  const alive = !!window && !window.isDestroyed()
  const foreground =
    alive && window!.isVisible() && window!.isFocused() && !opts?.forceNative

  if (!foreground) {
    showNativeNotification(toast.title, toast.message || '')
  }

  if (alive) {
    try {
      window!.webContents.send('app-toast', toast)
    } catch {
      /* ignore */
    }
  }
}
