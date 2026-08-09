import { Tray, Menu, nativeImage, app, dialog } from 'electron'
import { join } from 'path'
import {
  killProcess,
  openInBrowser,
  openInTerminal,
  restartProcess
} from './services/process-manager'
import {
  getLastPorts,
  onPortsChanged,
  notifyProfilesChanged,
  getSafetySettings,
  getRegisteredShortcut
} from './ipc'
import { loadProfilesState, addPortToProfileFile } from './profiles-persistence'
import type { PortInfo, Profile } from '../shared/types'

export interface TrayHandlers {
  showWindow: () => void
  hideWindow: () => void
  isWindowVisible: () => boolean
}

let tray: Tray | null = null
let removeListener: (() => void) | null = null
let handlers: TrayHandlers | null = null
let lastMenuSignature = ''

function getIconPath(): string {
  // extraResources copies resources/ next to the asar in packaged builds;
  // __dirname-relative paths only work in dev.
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources/iconTemplate.png')
  }
  return join(__dirname, '../../resources/iconTemplate.png')
}

function addToProfileMenuItem(
  port: PortInfo,
  profiles: Profile[]
): Electron.MenuItemConstructorOptions {
  if (profiles.length === 0) {
    return { label: 'Add to profile', enabled: false }
  }
  return {
    label: 'Add to profile',
    submenu: profiles.map((pr) => ({
      label: `${pr.icon} ${pr.name}`,
      click: () => {
        addPortToProfileFile(pr.id, port.port)
        notifyProfilesChanged()
      }
    }))
  }
}

function isProtected(port: PortInfo): boolean {
  return getSafetySettings().protectSystemPorts && port.isCritical
}

async function confirmTrayAction(action: string, detail: string): Promise<boolean> {
  if (!getSafetySettings().confirmDestructive) return true
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', action],
    defaultId: 0,
    cancelId: 0,
    title: action,
    message: action,
    detail
  })
  return response === 1
}

function portActionsSubmenu(
  port: PortInfo,
  profiles: Profile[],
  opts: { includeStats?: boolean } = {}
): Electron.MenuItemConstructorOptions[] {
  const protectedPort = isProtected(port)
  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: `Open in Browser`,
      click: () => openInBrowser(port.port)
    },
    {
      label: `Open in Terminal`,
      click: () => {
        void openInTerminal(port.pid, port.projectPath)
      }
    },
    {
      label: protectedPort ? 'Restart Port (protected)' : 'Restart Port',
      enabled: !protectedPort,
      click: async () => {
        const ok = await confirmTrayAction(
          'Restart Port',
          `Restart :${port.port} (${port.command}, PID ${port.pid})?`
        )
        if (!ok) return
        await restartProcess(port.pid, port.projectPath)
      }
    },
    {
      label: protectedPort ? 'Kill Process (protected)' : 'Kill Process',
      enabled: !protectedPort,
      click: async () => {
        const ok = await confirmTrayAction(
          'Kill Process',
          `Kill :${port.port} (${port.command}, PID ${port.pid})?`
        )
        if (!ok) return
        await killProcess(port.pid)
      }
    },
    addToProfileMenuItem(port, profiles)
  ]
  if (opts.includeStats) {
    items.push(
      { type: 'separator' as const },
      {
        label: `PID: ${port.pid}`,
        enabled: false
      },
      {
        label: `CPU: ${port.cpu.toFixed(1)}%  MEM: ${port.memory.toFixed(1)}%`,
        enabled: false
      }
    )
  }
  return items
}

function buildContextMenu(
  ports: PortInfo[],
  profiles: Profile[],
  openAtLogin: boolean
): Menu {
  const portItems: Electron.MenuItemConstructorOptions[] = ports
    .slice(0, 12)
    .map((port) => ({
      label: `:${port.port}  ${port.projectName || port.command}`,
      sublabel: `PID ${port.pid} — CPU ${port.cpu.toFixed(1)}%`,
      submenu: portActionsSubmenu(port, profiles, { includeStats: true })
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
      accelerator: getRegisteredShortcut() || undefined,
      click: () => {
        handlers?.showWindow()
      }
    },
    { type: 'separator' as const },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked })
      }
    },
    { type: 'separator' as const },
    {
      label: 'Quit PortPilot',
      accelerator: 'CommandOrControl+Q',
      click: () => {
        // app.exit() skips before-quit handlers (window state, polling cleanup)
        app.quit()
      }
    }
  ])
}

function syncDockMenu(ports: PortInfo[], profiles: Profile[]): void {
  if (process.platform !== 'darwin') return
  try {
    const dock = app.dock
    if (!dock || typeof dock.setMenu !== 'function') return

    const portDockItems: Electron.MenuItemConstructorOptions[] = ports
      .slice(0, 12)
      .map((port) => ({
        label: `:${port.port}  ${port.projectName || port.command}`,
        submenu: portActionsSubmenu(port, profiles, { includeStats: false })
      }))

    dock.setMenu(
      Menu.buildFromTemplate([
        {
          label: 'Show PortPilot',
          click: () => {
            handlers?.showWindow()
          }
        },
        { type: 'separator' as const },
        ...(ports.length === 0
          ? [{ label: 'No active ports', enabled: false }]
          : portDockItems),
        ...(ports.length > 12
          ? [
              {
                label: `…and ${ports.length - 12} more (use menu bar icon)`,
                enabled: false
              }
            ]
          : [])
      ])
    )
  } catch {
    // dock menu is best-effort
  }
}

function menuSignature(
  ports: PortInfo[],
  profiles: Profile[],
  openAtLogin: boolean
): string {
  const portSig = ports
    .slice(0, 12)
    .map(
      (p) =>
        `${p.port}:${p.pid}:${p.projectName || p.command}:${Math.round(p.cpu / 10)}:${Math.round(p.memory / 10)}`
    )
    .join('|')
  const profileSig = profiles
    .map((p) => `${p.id}:${p.icon}:${p.name}:${p.favoritePorts.join(',')}`)
    .join('|')
  const highCpuCount = ports.filter((p) => p.cpu > 50).length
  const hasWarning = ports.some((p) => p.cpu > 80)
  const safety = getSafetySettings()
  return [
    ports.length,
    highCpuCount,
    hasWarning,
    portSig,
    profileSig,
    openAtLogin,
    safety.protectSystemPorts,
    getRegisteredShortcut() || ''
  ].join('#')
}

function updateTray(ports: PortInfo[], force = false): void {
  const { profiles } = loadProfilesState()
  const openAtLogin = app.getLoginItemSettings().openAtLogin
  const signature = menuSignature(ports, profiles, openAtLogin)

  // setContextMenu closes the menu if the user has it open (macOS limitation),
  // so rebuilding on every poll yanks the menu away mid-click. Only rebuild
  // when something visible actually changed.
  if (!force && signature === lastMenuSignature) return
  lastMenuSignature = signature

  syncDockMenu(ports, profiles)

  if (!tray || tray.isDestroyed()) return

  try {
    tray.setContextMenu(buildContextMenu(ports, profiles, openAtLogin))

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

export function createTray(trayHandlers: TrayHandlers): Tray {
  handlers = trayHandlers

  const iconPath = getIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('PortPilot')

  tray.on('click', () => {
    // On macOS, clicking the tray icon opens the context menu — and Electron
    // still emits 'click' on mouseDown even when a menu is attached. Toggling
    // the window here would pop the window open alongside the menu.
    if (process.platform === 'darwin') return
    if (!handlers) return
    if (handlers.isWindowVisible()) handlers.hideWindow()
    else handlers.showWindow()
  })

  updateTray(getLastPorts(), true)

  removeListener = onPortsChanged((ports) => {
    updateTray(ports)
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
  handlers = null
  lastMenuSignature = ''
}
