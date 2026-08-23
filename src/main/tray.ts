import { Tray, Menu, app, BrowserWindow } from 'electron'
import {
  killProcess,
  openInBrowser,
  openInTerminal,
  restartProcess
} from './services/process-manager'
import { showMessageBox, loadTrayNativeImage, noteSuccessfulProcessAction } from './os'
import { IpcEvent } from '../shared/ipc'
import { sendEvent } from './ipc-handle'
import { markExpectedStopsForPid } from './services/expected-stops'
import {
  getLastPorts,
  onPortsChanged,
  notifyProfilesChanged,
  getSafetySettings,
  getRegisteredShortcut
} from './ipc'
import { loadProfilesState, addPortToProfileFile } from './profiles-persistence'
import {
  getClipboardHistory,
  isClipboardCaptureEnabled,
  setClipboardCapture,
  writeClipboardText,
  clearClipboardHistory,
  deleteClipboardItem
} from './modules/clipboard/clipboard-service'
import type { ClipboardItem, NavLocation, PortInfo, Profile } from '../shared/types'

export interface TrayHandlers {
  showWindow: () => void
  hideWindow: () => void
  isWindowVisible: () => boolean
}

let tray: Tray | null = null
let removeListener: (() => void) | null = null
let handlers: TrayHandlers | null = null
let lastMenuSignature = ''

function addToProfileMenuItem(
  port: PortInfo,
  profiles: Profile[]
): Electron.MenuItemConstructorOptions {
  const profileItems: Electron.MenuItemConstructorOptions[] = profiles.map(
    (pr) => {
      const already = pr.favoritePorts.includes(port.port)
      return {
        label: already
          ? `${pr.icon} ${pr.name}  ✓`
          : `${pr.icon} ${pr.name}`,
        enabled: !already,
        click: () => {
          addPortToProfileFile(pr.id, port.port)
          notifyProfilesChanged()
          refreshTrayMenus()
        }
      }
    }
  )
  return {
    label: 'Add to profiles',
    submenu: [
      ...profileItems,
      ...(profileItems.length > 0 ? [{ type: 'separator' as const }] : []),
      {
        label: 'New profile…',
        click: () => {
          handlers?.showWindow()
          for (const w of BrowserWindow.getAllWindows()) {
            try {
              sendEvent(w, IpcEvent.openProfileCreator)
            } catch {
              /* ignore */
            }
          }
        }
      }
    ]
  }
}

function isProtected(port: PortInfo): boolean {
  return getSafetySettings().protectSystemPorts && port.isCritical
}

async function confirmTrayAction(action: string, detail: string): Promise<boolean> {
  if (!getSafetySettings().confirmDestructive) return true
  const { response } = await showMessageBox({
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

function navigateFromTray(nav: NavLocation): void {
  handlers?.showWindow()
  for (const w of BrowserWindow.getAllWindows()) {
    try {
      sendEvent(w, IpcEvent.navigateTo, nav)
    } catch {
      /* ignore */
    }
  }
}

function clipPreview(text: string, max = 36): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (!oneLine) return '(empty)'
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1)}…`
}

function listenersOnly(ports: PortInfo[]): PortInfo[] {
  const hideSystem = getSafetySettings().hideSystemProcesses
  return ports.filter((p) => {
    if (p.role === 'connection') return false
    if (hideSystem && p.isSystem) return false
    return true
  })
}

function portsSubmenu(
  ports: PortInfo[],
  profiles: Profile[]
): Electron.MenuItemConstructorOptions[] {
  const highCpu = ports.filter((p) => p.cpu > 50).length

  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Open Ports',
      click: () => navigateFromTray({ module: 'ports', screen: 'dashboard' })
    }
  ]

  if (highCpu > 0) {
    items.push({
      label: `${highCpu} high CPU`,
      enabled: false
    })
  }

  if (ports.length === 0) {
    items.push({ label: 'No listening ports', enabled: false })
    return items
  }

  items.push({ type: 'separator' })
  for (const port of ports) {
    const name = port.projectName || port.command
    const runtime = port.runtime ? ` · ${port.runtime}` : ''
    items.push({
      label: `:${port.port}  ${name}`,
      sublabel: `PID ${port.pid} · ${port.cpu.toFixed(0)}% CPU${runtime}`,
      submenu: portActionsSubmenu(port, profiles)
    })
  }

  return items
}

function clipboardSubmenu(
  clips: ClipboardItem[],
  captureOn: boolean
): Electron.MenuItemConstructorOptions[] {
  const recent = clips.slice(0, 6)

  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Capture',
      type: 'checkbox',
      checked: captureOn,
      click: (menuItem) => {
        setClipboardCapture(menuItem.checked)
        refreshTrayMenus()
      }
    },
    {
      label: 'Open Clipboard',
      click: () => navigateFromTray({ module: 'text', screen: 'clipboard' })
    }
  ]

  if (recent.length === 0) {
    items.push(
      { type: 'separator' },
      {
        label: captureOn ? 'No clips yet' : 'Capture is off',
        enabled: false
      }
    )
    return items
  }

  items.push(
    { type: 'separator' },
    {
      label: `Recent (${clips.length})`,
      enabled: false
    }
  )

  for (const clip of recent) {
    items.push({
      label: `${clip.kind} · ${clipPreview(clip.text)}`,
      submenu: [
        {
          label: 'Copy again',
          click: () => writeClipboardText(clip.text)
        },
        {
          label: 'Delete',
          click: () => {
            deleteClipboardItem(clip.id)
            refreshTrayMenus()
          }
        }
      ]
    })
  }

  items.push(
    { type: 'separator' },
    {
      label: 'Clear unpinned',
      click: () => {
        clearClipboardHistory(true)
        refreshTrayMenus()
      }
    }
  )

  return items
}

function portActionsSubmenu(
  port: PortInfo,
  profiles: Profile[]
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
    }
  ]
  if (!protectedPort) {
    items.push(
      {
        label: 'Restart Port',
        click: async () => {
          const ok = await confirmTrayAction(
            'Restart Port',
            `Restart :${port.port} (${port.command}, PID ${port.pid})?`
          )
          if (!ok) return
          markExpectedStopsForPid(port.pid, getLastPorts())
          const restarted = await restartProcess(port.pid, port.projectPath)
          if (restarted.success) noteSuccessfulProcessAction()
        }
      },
      {
        label: 'Kill Process',
        click: async () => {
          const ok = await confirmTrayAction(
            'Kill Process',
            `Kill :${port.port} (${port.command}, PID ${port.pid})?`
          )
          if (!ok) return
          markExpectedStopsForPid(port.pid, getLastPorts())
          const killed = await killProcess(port.pid)
          if (killed) noteSuccessfulProcessAction()
        }
      }
    )
  }
  items.push(addToProfileMenuItem(port, profiles))
  return items
}

function buildContextMenu(
  ports: PortInfo[],
  profiles: Profile[],
  openAtLogin: boolean
): Menu {
  const clips = getClipboardHistory()
  const captureOn = isClipboardCaptureEnabled()
  const highCpu = ports.filter((p) => p.cpu > 50).length
  const portsLabel =
    highCpu > 0
      ? `Ports (${ports.length} · ${highCpu} high CPU)`
      : `Ports (${ports.length})`
  const clipboardLabel = captureOn
    ? `Clipboard (${clips.length})`
    : 'Clipboard (paused)'

  return Menu.buildFromTemplate([
    {
      label: portsLabel,
      submenu: portsSubmenu(ports, profiles)
    },
    {
      label: clipboardLabel,
      submenu: clipboardSubmenu(clips, captureOn)
    },
    { type: 'separator' },
    {
      label: 'Open PortPilot',
      accelerator: getRegisteredShortcut() || undefined,
      click: () => {
        handlers?.showWindow()
      }
    },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked })
      }
    },
    { type: 'separator' },
    {
      label: 'Quit PortPilot',
      accelerator: 'CommandOrControl+Q',
      click: () => {
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

    const clips = getClipboardHistory()
    const captureOn = isClipboardCaptureEnabled()

    dock.setMenu(
      Menu.buildFromTemplate([
        {
          label: 'Show PortPilot',
          click: () => {
            handlers?.showWindow()
          }
        },
        { type: 'separator' as const },
        {
          label: `Ports (${ports.length})`,
          submenu: portsSubmenu(ports, profiles)
        },
        {
          label: captureOn
            ? `Clipboard (${clips.length})`
            : 'Clipboard (paused)',
          submenu: clipboardSubmenu(clips, captureOn)
        }
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
  const clips = getClipboardHistory()
  const clipSig = clips
    .slice(0, 8)
    .map((c) => `${c.id}:${c.pinned ? 1 : 0}:${c.kind}`)
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
    getRegisteredShortcut() || '',
    isClipboardCaptureEnabled() ? 1 : 0,
    clips.length,
    clipSig
  ].join('#')
}

function updateTray(ports: PortInfo[], force = false): void {
  const listening = listenersOnly(ports)
  const { profiles } = loadProfilesState()
  const openAtLogin = app.getLoginItemSettings().openAtLogin
  const signature = menuSignature(listening, profiles, openAtLogin)

  // setContextMenu closes the menu if the user has it open (macOS limitation),
  // so rebuilding on every poll yanks the menu away mid-click. Only rebuild
  // when something visible actually changed.
  if (!force && signature === lastMenuSignature) return
  lastMenuSignature = signature

  syncDockMenu(listening, profiles)

  if (!tray || tray.isDestroyed()) return

  try {
    tray.setContextMenu(buildContextMenu(listening, profiles, openAtLogin))

    const title = listening.length > 0 ? `${listening.length}` : ''
    tray.setTitle(title, { fontType: 'monospacedDigit' })

    const hasWarning = listening.some((p) => p.cpu > 80)
    tray.setToolTip(
      hasWarning
        ? `PortPilot — ${listening.length} ports (⚠ high CPU)`
        : `PortPilot — ${listening.length} ports`
    )
  } catch {
    // tray update is best-effort
  }
}

/** Force tray + dock menus to rebuild (e.g. after profile create/delete). */
export function refreshTrayMenus(): void {
  updateTray(getLastPorts(), true)
}

export function createTray(trayHandlers: TrayHandlers): Tray {
  handlers = trayHandlers

  const icon = loadTrayNativeImage()
  if (!icon.isEmpty()) {
    icon.setTemplateImage(true)
  }

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
