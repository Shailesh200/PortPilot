import { useEffect, useCallback, useRef } from 'react'
import { usePortStore } from './stores/portStore'
import { useUIStore } from './stores/uiStore'
import { useSettingsStore } from './stores/settingsStore'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { Settings } from './components/Settings'
import { CommandPalette } from './components/CommandPalette'
import { QuickPeek } from './components/QuickPeek'
import { ToastContainer } from './components/Toast'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { PortsModule } from './modules/ports/PortsModule'
import { TextModule } from './modules/text/TextModule'
import { DatabaseModule } from './modules/database/DatabaseModule'

function applyActiveProfileFilter(): void {
  const { activeProfileId, profiles } = useSettingsStore.getState()
  const pr =
    activeProfileId && profiles.find((p) => p.id === activeProfileId)
  if (pr) {
    usePortStore.getState().setProfileFilter(pr.favoritePorts)
  } else {
    usePortStore.getState().setProfileFilter([])
  }
  usePortStore.getState().reapplyFiltersAndSort()
}

export default function App() {
  const fetchPorts = usePortStore((s) => s.fetchPorts)
  const setPorts = usePortStore((s) => s.setPorts)
  const nav = useUIStore((s) => s.nav)
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen)
  const isQuickPeekOpen = useUIStore((s) => s.isQuickPeekOpen)
  const darkMode = useSettingsStore((s) => s.darkMode)
  const refreshInterval = useSettingsStore((s) => s.refreshInterval)
  const globalShortcut = useSettingsStore((s) => s.globalShortcut)
  const protectSystemPorts = useSettingsStore((s) => s.protectSystemPorts)
  const confirmDestructive = useSettingsStore((s) => s.confirmDestructive)
  const notifyPortChange = useSettingsStore((s) => s.notifyPortChange)
  const notifyCrash = useSettingsStore((s) => s.notifyCrash)
  const autoOpenBrowser = useSettingsStore((s) => s.autoOpenBrowser)
  const autoFocusTerminal = useSettingsStore((s) => s.autoFocusTerminal)
  const confirmDialog = useUIStore((s) => s.confirmDialog)
  const hideConfirm = useUIStore((s) => s.hideConfirm)
  const addToast = useUIStore((s) => s.addToast)
  const isWorkspaceImmersive = useUIStore((s) => s.isWorkspaceImmersive)

  useKeyboardShortcuts()

  useEffect(() => {
    void window.api.loadProfiles().then((data) => {
      useSettingsStore.getState().applyLoadedProfiles(
        data?.profiles ?? [],
        data?.activeProfileId ?? null
      )
      applyActiveProfileFilter()
    })
  }, [])

  useEffect(() => {
    return window.api.onProfilesChanged(() => {
      void window.api.loadProfiles().then((data) => {
        useSettingsStore.getState().applyLoadedProfiles(
          data?.profiles ?? [],
          data?.activeProfileId ?? null
        )
        // Re-apply the active profile's port filter — previously the
        // filter stayed on whatever ports were active when the tray
        // mutation happened, so favorites added from the menu bar never
        // showed up in the dashboard.
        applyActiveProfileFilter()
      })
    })
  }, [])

  useEffect(() => {
    return window.api.onOpenProfileCreator(() => {
      useSettingsStore.getState().requestOpenProfileCreator()
      useUIStore.getState().setNav({ module: 'settings', screen: 'profiles' })
    })
  }, [])

  useEffect(() => {
    return window.api.onNavigateTo((nav) => {
      useUIStore.getState().setNav(nav)
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      darkMode ? 'dark' : 'light'
    )
  }, [darkMode])

  useEffect(() => {
    window.api.updatePollInterval(refreshInterval)
  }, [refreshInterval])

  useEffect(() => {
    void window.api.updateGlobalShortcut(globalShortcut).then((ok) => {
      if (!ok) {
        addToast({
          type: 'warning',
          title: 'Shortcut unavailable',
          message: `"${globalShortcut}" is taken or invalid — previous shortcut kept.`
        })
      }
    })
  }, [globalShortcut, addToast])

  // Keep the main-process kill/restart gate in sync with the UI toggles —
  // the tray menu and IPC handlers enforce these, not just the renderer.
  useEffect(() => {
    void window.api.updateSafetySettings({
      protectSystemPorts,
      confirmDestructive,
      autoFocusTerminal
    })
  }, [protectSystemPorts, confirmDestructive, autoFocusTerminal])

  // Port start/stop/crash alerts run in main (so they work while hidden).
  useEffect(() => {
    void window.api.updateAlertSettings({
      notifyPortChange,
      notifyCrash,
      autoOpenBrowser
    })
  }, [notifyPortChange, notifyCrash, autoOpenBrowser])

  useEffect(() => {
    return window.api.onAppToast((toast) => {
      addToast({
        type: toast.type,
        title: toast.title,
        message: toast.message
      })
    })
  }, [addToast])

  useEffect(() => {
    return window.api.onUpdateStatus((info) => {
      if (info.status === 'available') {
        addToast({
          type: 'info',
          title: 'Update available',
          message: `PortPilot ${info.version} is downloading…`
        })
      } else if (info.status === 'downloaded') {
        addToast({
          type: 'success',
          title: `Update ${info.version} ready`,
          message: 'Click to restart and install',
          duration: 0
        })
        // Surface a confirm so the user can install now.
        useUIStore.getState().showConfirm({
          title: 'Install Update',
          message: `PortPilot ${info.version} is ready. Restart now to install?`,
          variant: 'warning',
          confirmLabel: 'Restart & Install',
          onConfirm: () => {
            void window.api.quitAndInstall()
          }
        })
      } else if (info.status === 'error') {
        addToast({
          type: 'error',
          title: 'Update failed',
          message: info.message || 'Could not download the update'
        })
      }
    })
  }, [addToast])

  const highCpuAlertedRef = useRef<Set<number>>(new Set())
  const highMemAlertedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    fetchPorts()
    const cleanupPorts = window.api.onPortsUpdate((ports) => {
      setPorts(ports)

      const settings = useSettingsStore.getState()
      const toast = useUIStore.getState().addToast

      if (settings.notifyHighCpu) {
        for (const port of ports) {
          if (
            port.cpu > settings.cpuThreshold &&
            !highCpuAlertedRef.current.has(port.pid)
          ) {
            highCpuAlertedRef.current.add(port.pid)
            toast({
              type: 'warning',
              title: 'High CPU',
              message: `${port.projectName || port.command} (:${port.port}) at ${port.cpu.toFixed(1)}%`
            })
          } else if (port.cpu <= settings.cpuThreshold) {
            highCpuAlertedRef.current.delete(port.pid)
          }
        }
        for (const port of ports) {
          if (
            port.memory > settings.memoryThreshold &&
            !highMemAlertedRef.current.has(port.pid)
          ) {
            highMemAlertedRef.current.add(port.pid)
            toast({
              type: 'warning',
              title: 'High Memory',
              message: `${port.projectName || port.command} (:${port.port}) at ${port.memory.toFixed(1)}%`
            })
          } else if (port.memory <= settings.memoryThreshold) {
            highMemAlertedRef.current.delete(port.pid)
          }
        }
      }
    })
    const cleanupSearch = window.api.onFocusSearch(() => {
      document.getElementById('search-input')?.focus()
    })
    return () => {
      cleanupPorts()
      cleanupSearch()
    }
  }, [fetchPorts, setPorts])

  const renderView = useCallback(() => {
    switch (nav.module) {
      case 'ports':
        return <PortsModule />
      case 'text':
        return <TextModule />
      case 'database':
        return <DatabaseModule />
      case 'settings':
        return <Settings />
      default:
        return <PortsModule />
    }
  }, [nav.module])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {!isWorkspaceImmersive && <TitleBar />}
      <div
        className={
          isWorkspaceImmersive
            ? 'flex w-full h-full'
            : 'flex w-full h-full pt-[52px]'
        }
      >
        {!isWorkspaceImmersive && <Sidebar />}
        <main className="flex-1 overflow-hidden min-w-0">{renderView()}</main>
      </div>
      {isCommandPaletteOpen && <CommandPalette />}
      {isQuickPeekOpen && <QuickPeek />}
      <ToastContainer />
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={() => {
            confirmDialog.onConfirm()
            hideConfirm()
          }}
          onCancel={hideConfirm}
        />
      )}
    </div>
  )
}
