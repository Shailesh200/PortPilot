import { useEffect } from 'react'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'

function shouldIgnorePortShortcuts(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const el = target
  if (el.closest('[data-heatmap-cell]')) return false
  if (el.closest('[data-skip-port-shortcuts]')) return true
  if (el.closest('[role="dialog"]')) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON')
    return true
  if (el.isContentEditable) return true
  if (
    el.closest(
      'a[href], [role="button"], [role="checkbox"], [role="switch"], [role="combobox"], [role="listbox"], [role="menuitem"], [role="tab"]'
    )
  )
    return true
  return false
}

export function useKeyboardShortcuts() {
  const moveSelection = usePortStore((s) => s.moveSelection)
  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const selectedIndex = usePortStore((s) => s.selectedIndex)
  const killPort = usePortStore((s) => s.killPort)
  const restartPort = usePortStore((s) => s.restartPort)
  const openInBrowser = usePortStore((s) => s.openInBrowser)
  const openInTerminal = usePortStore((s) => s.openInTerminal)
  const openInVSCode = usePortStore((s) => s.openInVSCode)

  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen)
  const openQuickPeek = useUIStore((s) => s.openQuickPeek)
  const closeQuickPeek = useUIStore((s) => s.closeQuickPeek)
  const isQuickPeekOpen = useUIStore((s) => s.isQuickPeekOpen)
  const setView = useUIStore((s) => s.setView)
  const addToast = useUIStore((s) => s.addToast)
  const toggleRowExpansion = useUIStore((s) => s.toggleRowExpansion)
  const confirmDestructive = useSettingsStore((s) => s.confirmDestructive)
  const protectSystemPorts = useSettingsStore((s) => s.protectSystemPorts)
  const showConfirm = useUIStore((s) => s.showConfirm)
  const confirmDialog = useUIStore((s) => s.confirmDialog)
  const currentView = useUIStore((s) => s.currentView)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        setView('dashboard')
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault()
        setView('heatmap')
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') {
        e.preventDefault()
        setView('logs')
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setView('settings')
        return
      }

      if (isCommandPaletteOpen || isInput) return

      if (e.key === 'Escape') {
        if (isQuickPeekOpen) closeQuickPeek()
        return
      }

      if (confirmDialog) return

      if (isQuickPeekOpen) return

      const allowPortNav =
        currentView === 'dashboard' || currentView === 'heatmap'
      if (!allowPortNav) return

      if (shouldIgnorePortShortcuts(e.target)) return

      if (e.key === '/') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
        return
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        moveSelection(e.key === 'ArrowUp' ? 'up' : 'down')
        const { selectedIndex: idx, filteredPorts: ports } =
          usePortStore.getState()
        const p = ports[idx]
        if (p) {
          queueMicrotask(() => {
            const view = useUIStore.getState().currentView
            if (view === 'dashboard') {
              document
                .querySelector(`[data-port-row="${p.pid}"]`)
                ?.focus()
            } else if (view === 'heatmap') {
              document
                .querySelector(`[data-heatmap-cell="${p.pid}"]`)
                ?.focus()
            }
          })
        }
        return
      }

      if (e.key === 'ArrowRight') {
        if (currentView === 'dashboard') {
          const port = filteredPorts[selectedIndex]
          if (port) toggleRowExpansion(port.pid)
        }
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        const port = filteredPorts[selectedIndex]
        if (port) openQuickPeek(port.pid)
        return
      }

      const selectedPort = filteredPorts[selectedIndex]
      if (!selectedPort) return

      switch (e.key.toLowerCase()) {
        case 'k': {
          if (protectSystemPorts && selectedPort.isCritical) {
            addToast({
              type: 'warning',
              title: 'Protected Port',
              message: `Port ${selectedPort.port} is protected.`
            })
            break
          }
          const doKill = () => killPort(selectedPort.pid).then((success) => {
            addToast({
              type: success ? 'success' : 'error',
              title: success ? 'Process Killed' : 'Failed',
              message: `Port ${selectedPort.port} (${selectedPort.command})`
            })
          })
          if (confirmDestructive) {
            showConfirm({
              title: 'Kill Process',
              message: `Kill port ${selectedPort.port} (${selectedPort.command})?`,
              confirmLabel: 'Kill',
              onConfirm: doKill
            })
          } else {
            doKill()
          }
          break
        }
        case 'o':
          openInBrowser(selectedPort.port)
          break
        case 't':
          openInTerminal(selectedPort.pid, selectedPort.projectPath)
          break
        case 'v':
          openInVSCode(selectedPort.pid, selectedPort.projectPath)
          break
        case 'r': {
          const doRestart = () => {
            addToast({ type: 'info', title: 'Restarting...', message: `Port ${selectedPort.port} (${selectedPort.command})` })
            restartPort(selectedPort.pid, selectedPort.projectPath).then((result) => {
              addToast({
                type: result.success ? 'success' : 'error',
                title: result.success ? 'Process restarted' : 'Restart Failed',
                message: result.success
                  ? result.hint || `Port ${selectedPort.port} — command re-launched`
                  : result.error || 'Unknown error'
              })
            })
          }
          if (confirmDestructive) {
            showConfirm({
              title: 'Restart Process',
              message: `Restart port ${selectedPort.port} (${selectedPort.command})?`,
              variant: 'warning',
              confirmLabel: 'Restart',
              onConfirm: doRestart
            })
          } else {
            doRestart()
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    moveSelection,
    filteredPorts,
    selectedIndex,
    killPort,
    restartPort,
    openInBrowser,
    openInTerminal,
    openInVSCode,
    toggleCommandPalette,
    isCommandPaletteOpen,
    openQuickPeek,
    closeQuickPeek,
    isQuickPeekOpen,
    setView,
    addToast,
    toggleRowExpansion,
    confirmDestructive,
    protectSystemPorts,
    showConfirm,
    confirmDialog,
    currentView
  ])
}
