import { useEffect, useCallback, useRef } from 'react'
import { usePortStore } from './stores/portStore'
import { useUIStore } from './stores/uiStore'
import { useSettingsStore } from './stores/settingsStore'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { Dashboard } from './components/Dashboard'
import { Heatmap } from './components/Heatmap'
import { LogViewer } from './components/LogViewer'
import { Settings } from './components/Settings'
import { CommandPalette } from './components/CommandPalette'
import { QuickPeek } from './components/QuickPeek'
import { ToastContainer } from './components/Toast'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const fetchPorts = usePortStore((s) => s.fetchPorts)
  const setPorts = usePortStore((s) => s.setPorts)
  const currentView = useUIStore((s) => s.currentView)
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen)
  const isQuickPeekOpen = useUIStore((s) => s.isQuickPeekOpen)
  const darkMode = useSettingsStore((s) => s.darkMode)
  const refreshInterval = useSettingsStore((s) => s.refreshInterval)
  const globalShortcut = useSettingsStore((s) => s.globalShortcut)
  const confirmDialog = useUIStore((s) => s.confirmDialog)
  const hideConfirm = useUIStore((s) => s.hideConfirm)
  const reapplyFiltersAndSort = usePortStore((s) => s.reapplyFiltersAndSort)

  useKeyboardShortcuts()

  useEffect(() => {
    void window.api.loadProfiles().then((data) => {
      if (!data?.profiles?.length) return
      useSettingsStore.getState().applyLoadedProfiles(
        data.profiles,
        data.activeProfileId
      )
      const { activeProfileId, profiles } = useSettingsStore.getState()
      const pr =
        activeProfileId && profiles.find((p) => p.id === activeProfileId)
      if (pr) {
        usePortStore.getState().setProfileFilter(pr.favoritePorts)
      } else {
        usePortStore.getState().setProfileFilter([])
      }
      reapplyFiltersAndSort()
    })
  }, [reapplyFiltersAndSort])

  useEffect(() => {
    return window.api.onProfilesChanged(() => {
      void window.api.loadProfiles().then((data) => {
        if (!data?.profiles?.length) return
        useSettingsStore.getState().applyLoadedProfiles(
          data.profiles,
          data.activeProfileId
        )
        reapplyFiltersAndSort()
      })
    })
  }, [reapplyFiltersAndSort])

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
    void window.api.updateGlobalShortcut(globalShortcut)
  }, [globalShortcut])

  const prevPortsRef = useRef<Set<number>>(new Set())
  const highCpuAlertedRef = useRef<Set<number>>(new Set())
  const highMemAlertedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    fetchPorts()
    const cleanupPorts = window.api.onPortsUpdate((ports) => {
      setPorts(ports)

      const settings = useSettingsStore.getState()
      const addToast = useUIStore.getState().addToast
      const currentPorts = new Set(ports.map((p) => p.port))
      const prevPorts = prevPortsRef.current

      if (settings.notifyPortChange && prevPorts.size > 0) {
        for (const port of ports) {
          if (!prevPorts.has(port.port)) {
            addToast({
              type: 'info',
              title: 'Port Started',
              message: `${port.projectName || port.command} on :${port.port}`
            })
            if (settings.autoOpenBrowser) {
              window.api.openInBrowser(port.port)
            }
          }
        }
        for (const prevPort of prevPorts) {
          if (!currentPorts.has(prevPort)) {
            addToast({
              type: 'warning',
              title: 'Port Stopped',
              message: `Port :${prevPort} is no longer listening`
            })
          }
        }
      }

      if (settings.notifyHighCpu) {
        for (const port of ports) {
          if (
            port.cpu > settings.cpuThreshold &&
            !highCpuAlertedRef.current.has(port.pid)
          ) {
            highCpuAlertedRef.current.add(port.pid)
            addToast({
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
            addToast({
              type: 'warning',
              title: 'High Memory',
              message: `${port.projectName || port.command} (:${port.port}) at ${port.memory.toFixed(1)}%`
            })
          } else if (port.memory <= settings.memoryThreshold) {
            highMemAlertedRef.current.delete(port.pid)
          }
        }
      }

      prevPortsRef.current = currentPorts
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
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />
      case 'heatmap':
        return <Heatmap />
      case 'logs':
        return <LogViewer />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }, [currentView])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <TitleBar />
      <div className="flex w-full h-full pt-[52px]">
        <Sidebar />
        <main className="flex-1 overflow-hidden">{renderView()}</main>
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
