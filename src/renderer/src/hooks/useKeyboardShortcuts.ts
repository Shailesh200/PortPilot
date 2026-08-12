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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      const ui = useUIStore.getState()
      const settings = useSettingsStore.getState()
      const ports = usePortStore.getState()

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        ui.toggleCommandPalette()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        ui.openModule('ports')
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault()
        ui.openModule('text')
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') {
        e.preventDefault()
        ui.openModule('database')
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        ui.openModule('settings')
        return
      }

      if (ui.isCommandPaletteOpen || isInput) return

      if (e.key === 'Escape') {
        if (ui.isQuickPeekOpen) ui.closeQuickPeek()
        return
      }

      if (ui.confirmDialog) return
      if (ui.isQuickPeekOpen) return

      const portsScreen =
        ui.nav.module === 'ports' ? ui.nav.screen : null
      const allowPortNav =
        portsScreen === 'dashboard' || portsScreen === 'heatmap'
      if (!allowPortNav) return

      if (shouldIgnorePortShortcuts(e.target)) return

      if (e.key === '/') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
        return
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        ports.moveSelection(e.key === 'ArrowUp' ? 'up' : 'down')
        const { selectedIndex: idx, filteredPorts: list } =
          usePortStore.getState()
        const p = list[idx]
        if (p) {
          queueMicrotask(() => {
            const n = useUIStore.getState().nav
            const screen = n.module === 'ports' ? n.screen : null
            const selector =
              screen === 'dashboard'
                ? `[data-port-row="${p.pid}"]`
                : screen === 'heatmap'
                  ? `[data-heatmap-cell="${p.pid}"]`
                  : null
            if (!selector) return
            const el = document.querySelector(selector)
            if (el instanceof HTMLElement) el.focus()
          })
        }
        return
      }

      const { filteredPorts, selectedIndex } = usePortStore.getState()

      if (e.key === 'ArrowRight') {
        if (portsScreen === 'dashboard') {
          const port = filteredPorts[selectedIndex]
          if (port) ui.toggleRowExpansion(port.pid)
        }
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        const port = filteredPorts[selectedIndex]
        if (port) ui.openQuickPeek(port.pid)
        return
      }

      const selectedPort = filteredPorts[selectedIndex]
      if (!selectedPort) return

      switch (e.key.toLowerCase()) {
        case 'k': {
          if (settings.protectSystemPorts && selectedPort.isCritical) {
            ui.addToast({
              type: 'warning',
              title: 'Protected Port',
              message: `Port ${selectedPort.port} is protected.`
            })
            break
          }
          const doKill = () =>
            ports.killPort(selectedPort.pid).then((success) => {
              useUIStore.getState().addToast({
                type: success ? 'success' : 'error',
                title: success ? 'Process Killed' : 'Failed',
                message: `Port ${selectedPort.port} (${selectedPort.command})`
              })
            })
          if (settings.confirmDestructive) {
            ui.showConfirm({
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
          void ports.openInBrowser(selectedPort.port)
          break
        case 't':
          void ports.openInTerminal(selectedPort.pid, selectedPort.projectPath)
          break
        case 'v':
          void ports.openInVSCode(selectedPort.pid, selectedPort.projectPath)
          break
        case 'r': {
          const doRestart = () => {
            useUIStore.getState().addToast({
              type: 'info',
              title: 'Restarting...',
              message: `Port ${selectedPort.port} (${selectedPort.command})`
            })
            ports
              .restartPort(selectedPort.pid, selectedPort.projectPath)
              .then((result) => {
                useUIStore.getState().addToast({
                  type: result.success ? 'success' : 'error',
                  title: result.success ? 'Process restarted' : 'Restart Failed',
                  message: result.success
                    ? result.hint ||
                      `Port ${selectedPort.port} — command re-launched`
                    : result.error || 'Unknown error'
                })
              })
          }
          if (settings.confirmDestructive) {
            ui.showConfirm({
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
  }, [])
}
