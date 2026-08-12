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
import {
  registerIpcHandlers,
  startPortPolling,
  stopPortPolling,
  setShortcutCallback,
  updateGlobalShortcut
} from './ipc'
import { createTray, destroyTray } from './tray'
import { initAutoUpdater } from './updater'
import { setNotificationClickHandler } from './services/notifications'
import { shutdownWorkbench } from './modules/workbench-ipc'
import { DEFAULT_SETTINGS } from '../shared/defaults'
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
let isQuitting = false

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

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { webContents } = mainWindow
  if (webContents.isCrashed()) {
    webContents.once('did-finish-load', () => showMainWindow())
    webContents.reload()
    return
  }
  if (webContents.isLoading()) {
    // Forcing a show mid-load paints only the background color — the
    // "black window" symptom. Wait for the load to finish instead.
    webContents.once('did-finish-load', () => showMainWindow())
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
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
      nodeIntegration: false,
      // Keep the compositor alive while hidden; otherwise a long-hidden
      // window can repaint as a black screen when shown again on macOS.
      backgroundThrottling: false
    }
  })

  let hasAutoShown = false
  mainWindow.on('ready-to-show', () => {
    // Auto-show only on the first load. After a crash-triggered reload the
    // window stays hidden until the user explicitly summons it.
    if (!hasAutoShown) {
      hasAutoShown = true
      mainWindow?.show()
    }
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer process gone:', details.reason)
    // Reload so a crash while hidden doesn't surface as a black window later.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload()
    }
  })

  mainWindow.webContents.on('unresponsive', () => {
    log.warn('Renderer became unresponsive')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const sendFullScreen = (isFullScreen: boolean): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-full-screen-changed', isFullScreen)
    }
  }
  mainWindow.on('enter-full-screen', () => sendFullScreen(true))
  mainWindow.on('leave-full-screen', () => sendFullScreen(false))

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

  if (is.dev) {
    // Electron levels: 0 verbose, 1 info, 2 warning, 3 error
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 3) {
        log.error(`[renderer] ${message} (${sourceId}:${line})`)
      }
    })
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      log.error(`did-fail-load ${code} ${desc} ${url}`)
    })
  }

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
    if (mainWindow && !mainWindow.isDestroyed()) {
      showMainWindow()
      const { webContents } = mainWindow
      if (!webContents.isLoading() && !webContents.isCrashed()) {
        webContents.send('focus-search')
      }
    }
  }
  setShortcutCallback(callback)
  if (!updateGlobalShortcut(DEFAULT_SETTINGS.globalShortcut)) {
    log.warn(`Could not register default shortcut: ${DEFAULT_SETTINGS.globalShortcut}`)
  }
}

// A second launch (Spotlight, `open -a`, dock) should surface the existing
// window, not spawn a duplicate app fighting over the same tray + shortcut.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    setNotificationClickHandler(() => showMainWindow())
    createWindow()
    registerGlobalShortcuts()
    createTray({
      showWindow: showMainWindow,
      hideWindow: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
      },
      isWindowVisible: () =>
        Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible())
    })

    app.on('activate', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        showMainWindow()
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
      app.quit()
    }
  })

  app.on('before-quit', (event) => {
    if (isQuitting) return
    isQuitting = true
    event.preventDefault()
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow)
      mainWindow.removeAllListeners('close')
      mainWindow.close()
    }
    stopPortPolling()
    globalShortcut.unregisterAll()
    destroyTray()
    void shutdownWorkbench().finally(() => app.exit(0))
  })
}
