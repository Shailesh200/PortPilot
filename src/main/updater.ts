import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import log from './logger'
import type { UpdateInfo } from '../shared/types'
import { IpcChannel, IpcEvent } from '../shared/ipc'
import { handleInvoke, sendEvent } from './ipc-handle'

autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function send(mainWindow: BrowserWindow, info: UpdateInfo): void {
  sendEvent(mainWindow, IpcEvent.updateStatus, info)
}

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  if (process.mas) {
    log.info('Mac App Store build: skipping GitHub auto-update')
    handleInvoke(IpcChannel.quitAndInstall, () => undefined)
    return
  }

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    send(mainWindow, { version: info.version, status: 'available' })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    send(mainWindow, { version: info.version, status: 'downloaded' })
  })

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err)
    send(mainWindow, {
      version: '',
      status: 'error',
      message: err?.message || String(err)
    })
  })

  handleInvoke(IpcChannel.quitAndInstall, () => {
    autoUpdater.quitAndInstall()
  })

  // Don't compete with first paint / port scan — check after idle.
  const runCheck = (): void => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('Update check failed:', err)
    })
  }
  setTimeout(runCheck, 15_000)
}
