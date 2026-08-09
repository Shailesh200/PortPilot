import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'
import log from './logger'
import type { UpdateInfo } from '../shared/types'

autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

function send(mainWindow: BrowserWindow, info: UpdateInfo): void {
  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', info)
  }
}

export function initAutoUpdater(mainWindow: BrowserWindow): void {
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

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.checkForUpdates().catch((err) => {
    log.warn('Update check failed:', err)
  })
}
