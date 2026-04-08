import {
  app,
  BrowserWindow,
  crashReporter,
  globalShortcut,
  screen,
  shell
} from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers, startPortPolling, stopPortPolling, setShortcutCallback } from './ipc'
import { createTray, destroyTray } from './tray'
import { initAutoUpdater } from './updater'
import log from './logger'

crashReporter.start({
  submitURL: '',
  uploadToServer: false
})

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason)
})

let mainWindow: BrowserWindow | null = null

const stateFilePath = join(app.getPath('userData'), 'window-state.json')

function loadWindowState(): {
  x?: number
  y?: number
  width: number
  height: number
} {
  try {
    const data = JSON.parse(readFileSync(stateFilePath, 'utf-8'))
    const width = typeof data.width === 'number' ? data.width : 1200
    const height = typeof data.height === 'number' ? data.height : 800
    if (typeof data.x === 'number' && typeof data.y === 'number') {
      const displays = screen.getAllDisplays()
      const inBounds = displays.some((d) => {
        const b = d.bounds
        return (
          data.x >= b.x &&
          data.x < b.x + b.width &&
          data.y >= b.y &&
          data.y < b.y + b.height
        )
      })
      if (inBounds) return { x: data.x, y: data.y, width, height }
    }
    return { width, height }
  } catch {
    return { width: 1200, height: 800 }
  }
}

function saveWindowState(win: BrowserWindow): void {
  if (win.isMinimized() || win.isMaximized()) return
  const bounds = win.getBounds()
  try {
    writeFileSync(stateFilePath, JSON.stringify(bounds))
  } catch {
    /* ignore */
  }
}

function createWindow(): void {
  const windowState = loadWindowState()

  mainWindow = new BrowserWindow({
    ...windowState,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin') {
      if (mainWindow) saveWindowState(mainWindow)
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  startPortPolling(mainWindow)

  if (!is.dev) {
    initAutoUpdater(mainWindow)
  }
}

function registerGlobalShortcuts(): void {
  const callback = () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('focus-search')
    }
  }
  setShortcutCallback(callback)
  globalShortcut.register('CommandOrControl+Shift+P', callback)
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
  registerGlobalShortcuts()
  createTray(mainWindow)

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })

  log.info('PortPilot started')
}).catch((err) => {
  log.error('Failed to start:', err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopPortPolling()
    globalShortcut.unregisterAll()
    destroyTray()
    app.quit()
  }
})

app.on('before-quit', () => {
  if (mainWindow) {
    saveWindowState(mainWindow)
    mainWindow.removeAllListeners('close')
    mainWindow.close()
  }
  stopPortPolling()
  globalShortcut.unregisterAll()
  destroyTray()
})
