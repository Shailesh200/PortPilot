import { useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { applyActiveProfileFilter } from './lib/applyProfile'
import { usePortStore } from './stores/portStore'
import { useUIStore } from './stores/uiStore'
import { useSettingsStore } from './stores/settingsStore'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { ToastContainer } from './components/Toast'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { PortsModule } from './modules/ports/PortsModule'

const Settings = lazy(() =>
  import('./components/Settings').then((m) => ({ default: m.Settings }))
)
const ProfileCreatorDialog = lazy(() =>
  import('./components/Settings').then((m) => ({
    default: m.ProfileCreatorDialog
  }))
)
const TextModule = lazy(() =>
  import('./modules/text/TextModule').then((m) => ({ default: m.TextModule }))
)
const DatabaseModule = lazy(() =>
  import('./modules/database/DatabaseModule').then((m) => ({
    default: m.DatabaseModule
  }))
)
const CommandPalette = lazy(() =>
  import('./components/CommandPalette').then((m) => ({
    default: m.CommandPalette
  }))
)
const QuickPeek = lazy(() =>
  import('./components/QuickPeek').then((m) => ({ default: m.QuickPeek }))
)

function ModuleFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-text-muted">
      Loading…
    </div>
  )
}

export default function App() {
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
  const hideSystemProcesses = useSettingsStore((s) => s.hideSystemProcesses)
  const autoUpdate = useSettingsStore((s) => s.autoUpdate)
  const confirmDialog = useUIStore((s) => s.confirmDialog)
  const hideConfirm = useUIStore((s) => s.hideConfirm)
  const addToast = useUIStore((s) => s.addToast)
  const isWorkspaceImmersive = useUIStore((s) => s.isWorkspaceImmersive)

  useKeyboardShortcuts()

  // Restore last-in-module screens after first paint. Current `nav` is not
  // persisted — cold start always stays on Ports.
  useEffect(() => {
    let cancelled = false
    const restore = (): void => {
      if (cancelled) return
      void useUIStore.persist.rehydrate()
    }
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        cancelIdleCallback?: (id: number) => void
      }
    ).requestIdleCallback
    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (typeof ric === 'function') {
      idleId = ric(restore, { timeout: 1200 })
    } else {
      timeoutId = setTimeout(restore, 0)
    }
    return () => {
      cancelled = true
      if (idleId != null) {
        ;(
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(idleId)
      }
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [])

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
      autoFocusTerminal,
      hideSystemProcesses
    })
  }, [protectSystemPorts, confirmDestructive, autoFocusTerminal, hideSystemProcesses])

  // Port start/stop/crash alerts run in main (so they work while hidden).
  useEffect(() => {
    void window.api.updateAlertSettings({
      notifyPortChange,
      notifyCrash,
      autoOpenBrowser
    })
  }, [notifyPortChange, notifyCrash, autoOpenBrowser])

  useEffect(() => {
    void window.api.updateAutoUpdate(autoUpdate)
  }, [autoUpdate])

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
          title: 'New version available',
          message: `PortPilot ${info.version} is ready to download from Settings.`
        })
      } else if (info.status === 'downloaded') {
        addToast({
          type: 'success',
          title: `Version ${info.version} is ready`,
          message: 'Restart PortPilot to finish updating.',
          duration: 0
        })
      }
    })
  }, [addToast])

  const highCpuAlertedRef = useRef<Set<number>>(new Set())
  const highMemAlertedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    // Initial ports arrive from main's poll (interval 0); avoid a duplicate scan.
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
  }, [setPorts])

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
        <main className="flex-1 overflow-hidden min-w-0">
          <Suspense fallback={<ModuleFallback />}>{renderView()}</Suspense>
        </main>
      </div>
      {isCommandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      {isQuickPeekOpen && (
        <Suspense fallback={null}>
          <QuickPeek />
        </Suspense>
      )}
      <ToastContainer />
      <Suspense fallback={null}>
        <ProfileCreatorDialog />
      </Suspense>
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
