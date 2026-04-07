import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import log from './logger'

autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info.version)
    }
    autoUpdater.downloadUpdate()
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', info.version)
    }
  })

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err)
  })

  autoUpdater.checkForUpdates().catch((err) => {
    log.warn('Update check failed:', err)
  })
}
