import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { killProcess, openInBrowser } from './services/process-manager'
import { getLastPorts, onPortsChanged } from './ipc'
import type { PortInfo } from '../shared/types'

let tray: Tray | null = null
let removeListener: (() => void) | null = null

function getIconPath(): string {
  return join(__dirname, '../../resources/iconTemplate.png')
}

function buildContextMenu(
  mainWindow: BrowserWindow | null,
  ports: PortInfo[]
): Menu {
  const portItems: Electron.MenuItemConstructorOptions[] = ports
    .slice(0, 12)
    .map((port) => ({
      label: `:${port.port}  ${port.projectName || port.command}`,
      sublabel: `PID ${port.pid} — CPU ${port.cpu.toFixed(1)}%`,
      submenu: [
        {
          label: `Open in Browser`,
          click: () => openInBrowser(port.port)
        },
        {
          label: `Kill Process`,
          click: async () => {
            await killProcess(port.pid)
          }
        },
        { type: 'separator' as const },
        {
          label: `PID: ${port.pid}`,
          enabled: false
        },
        {
          label: `CPU: ${port.cpu.toFixed(1)}%  MEM: ${port.memory.toFixed(1)}%`,
          enabled: false
        }
      ]
    }))

  const hasHighCpu = ports.some((p) => p.cpu > 50)

  return Menu.buildFromTemplate([
    {
      label: `${ports.length} Active Port${ports.length !== 1 ? 's' : ''}`,
      enabled: false
    },
    ...(hasHighCpu
      ? [
          {
            label: `⚠ ${ports.filter((p) => p.cpu > 50).length} High CPU`,
            enabled: false
          }
        ]
      : []),
    { type: 'separator' as const },
    ...portItems,
    ...(ports.length > 12
      ? [
          {
            label: `... and ${ports.length - 12} more`,
            enabled: false
          }
        ]
      : []),
    ...(ports.length === 0
      ? [{ label: 'No listening ports', enabled: false }]
      : []),
    { type: 'separator' as const },
    {
      label: 'Open PortPilot',
      accelerator: 'CommandOrControl+Shift+P',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' as const },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked })
      }
    },
    { type: 'separator' as const },
    {
      label: 'Quit PortPilot',
      accelerator: 'CommandOrControl+Q',
      click: () => {
        app.exit(0)
      }
    }
  ])
}

function updateTray(mainWindow: BrowserWindow | null, ports: PortInfo[]): void {
  if (!tray || tray.isDestroyed()) return

  try {
    const menu = buildContextMenu(mainWindow, ports)
    tray.setContextMenu(menu)

    const title = ports.length > 0 ? `${ports.length}` : ''
    tray.setTitle(title, { fontType: 'monospacedDigit' })

    const hasWarning = ports.some((p) => p.cpu > 80)
    tray.setToolTip(
      hasWarning
        ? `PortPilot — ${ports.length} ports (⚠ high CPU)`
        : `PortPilot — ${ports.length} ports`
    )
  } catch {
    // tray update is best-effort
  }
}

export function createTray(mainWindow: BrowserWindow | null): Tray {
  const iconPath = getIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('PortPilot')

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  updateTray(mainWindow, getLastPorts())

  removeListener = onPortsChanged((ports) => {
    updateTray(mainWindow, ports)
  })

  return tray
}

export function destroyTray(): void {
  if (removeListener) {
    removeListener()
    removeListener = null
  }
  if (tray && !tray.isDestroyed()) {
    tray.destroy()
    tray = null
  }
}
