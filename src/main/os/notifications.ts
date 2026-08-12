import { Notification } from 'electron'
import log from '../logger'

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
