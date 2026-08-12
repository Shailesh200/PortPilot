import { BrowserWindow } from 'electron'
import { IpcEvent, type AppToastPayload } from '../../shared/ipc'
import { sendEvent } from '../ipc-handle'
import { showNativeNotification } from '../os/notifications'

export type { AppToastPayload }

export { setNotificationClickHandler } from '../os/notifications'

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
      sendEvent(window!, IpcEvent.appToast, toast)
    } catch {
      /* ignore */
    }
  }
}
