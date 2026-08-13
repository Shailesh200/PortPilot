import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModuleId, NavLocation, Toast } from '../../../shared/types'
import { DEFAULT_NAV } from '../../../shared/types'

type PortsNav = Extract<NavLocation, { module: 'ports' }>
type TextNav = Extract<NavLocation, { module: 'text' }>
type DatabaseNav = Extract<NavLocation, { module: 'database' }>
type SettingsNav = Extract<NavLocation, { module: 'settings' }>

interface UIState {
  nav: NavLocation
  navStack: NavLocation[]
  lastPortsNav: PortsNav | null
  lastTextNav: TextNav | null
  lastDatabaseNav: DatabaseNav | null
  lastSettingsNav: SettingsNav | null
  isCommandPaletteOpen: boolean
  isQuickPeekOpen: boolean
  quickPeekPid: number | null
  /** Hide app chrome so Diff/Formatter fill the window (paired with native fullscreen). */
  isWorkspaceImmersive: boolean
  toasts: Toast[]
  expandedRows: Set<number>
  confirmDialog: {
    open: boolean
    title: string
    message: string
    variant: 'danger' | 'warning'
    confirmLabel: string
    onConfirm: () => void
  } | null

  setNav: (nav: NavLocation, pushStack?: boolean) => void
  goBack: () => void
  openModule: (module: ModuleId) => void
  toggleCommandPalette: () => void
  closeCommandPalette: () => void
  openQuickPeek: (pid: number) => void
  closeQuickPeek: () => void
  setWorkspaceImmersive: (value: boolean) => void
  toggleRowExpansion: (pid: number) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  showConfirm: (opts: {
    title: string
    message: string
    variant?: 'danger' | 'warning'
    confirmLabel?: string
    onConfirm: () => void
  }) => void
  hideConfirm: () => void
}

function defaultForModule(module: ModuleId): NavLocation {
  switch (module) {
    case 'ports':
      return { module: 'ports', screen: 'dashboard' }
    case 'text':
      return { module: 'text', screen: 'landing' }
    case 'database':
      return { module: 'database', screen: 'connections' }
    case 'settings':
      return { module: 'settings', screen: 'general' }
  }
}

function rememberNav(
  nav: NavLocation,
  prev: Pick<
    UIState,
    'lastPortsNav' | 'lastTextNav' | 'lastDatabaseNav' | 'lastSettingsNav'
  >
) {
  return {
    lastPortsNav: nav.module === 'ports' ? nav : prev.lastPortsNav,
    lastTextNav: nav.module === 'text' ? nav : prev.lastTextNav,
    lastDatabaseNav: nav.module === 'database' ? nav : prev.lastDatabaseNav,
    lastSettingsNav: nav.module === 'settings' ? nav : prev.lastSettingsNav
  }
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      nav: DEFAULT_NAV,
      navStack: [],
      lastPortsNav: null,
      lastTextNav: null,
      lastDatabaseNav: null,
      lastSettingsNav: null,
      isCommandPaletteOpen: false,
      isQuickPeekOpen: false,
      quickPeekPid: null,
      isWorkspaceImmersive: false,
      toasts: [],
      expandedRows: new Set(),
      confirmDialog: null,

      setNav: (nav, pushStack = true) =>
        set((s) => ({
          nav,
          navStack: pushStack
            ? [...s.navStack.slice(-7), s.nav]
            : s.navStack,
          isWorkspaceImmersive: false,
          ...rememberNav(nav, s)
        })),

      goBack: () =>
        set((s) => {
          if (s.navStack.length === 0) return s
          const stack = [...s.navStack]
          const prev = stack.pop()!
          return {
            nav: prev,
            navStack: stack,
            isWorkspaceImmersive: false,
            ...rememberNav(prev, s)
          }
        }),

      openModule: (module) => {
        const s = get()
        const restored =
          module === 'ports'
            ? s.lastPortsNav
            : module === 'text'
              ? s.lastTextNav
              : module === 'database'
                ? s.lastDatabaseNav
                : module === 'settings'
                  ? s.lastSettingsNav
                  : null
        get().setNav(restored ?? defaultForModule(module))
      },

      toggleCommandPalette: () =>
        set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),

      closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

      openQuickPeek: (pid) =>
        set({ isQuickPeekOpen: true, quickPeekPid: pid }),

      closeQuickPeek: () => {
        set({ isQuickPeekOpen: false, quickPeekPid: null })
      },

      setWorkspaceImmersive: (value) => set({ isWorkspaceImmersive: value }),

      toggleRowExpansion: (pid) => {
        const { expandedRows } = get()
        const next = new Set(expandedRows)
        if (next.has(pid)) next.delete(pid)
        else next.add(pid)
        set({ expandedRows: next })
      },

      addToast: (toast) => {
        const id = crypto.randomUUID()
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
        const ms = toast.duration ?? 4000
        if (ms > 0) {
          setTimeout(() => get().removeToast(id), ms)
        }
      },

      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      showConfirm: (opts) =>
        set({
          confirmDialog: {
            open: true,
            title: opts.title,
            message: opts.message,
            variant: opts.variant || 'danger',
            confirmLabel: opts.confirmLabel || 'Confirm',
            onConfirm: opts.onConfirm
          }
        }),

      hideConfirm: () => set({ confirmDialog: null })
    }),
    {
      name: 'portpilot-ui',
      // Cold start always uses DEFAULT_NAV (Ports). App.tsx rehydrates
      // last-* so the sidebar can restore the last screen inside a module.
      skipHydration: true,
      partialize: (s) => ({
        lastPortsNav: s.lastPortsNav,
        lastTextNav: s.lastTextNav,
        lastDatabaseNav: s.lastDatabaseNav,
        lastSettingsNav: s.lastSettingsNav
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<
          Pick<
            UIState,
            | 'lastPortsNav'
            | 'lastTextNav'
            | 'lastDatabaseNav'
            | 'lastSettingsNav'
          >
        >
        return {
          ...current,
          lastPortsNav: p.lastPortsNav ?? current.lastPortsNav,
          lastTextNav: p.lastTextNav ?? current.lastTextNav,
          lastDatabaseNav: p.lastDatabaseNav ?? current.lastDatabaseNav,
          lastSettingsNav: p.lastSettingsNav ?? current.lastSettingsNav
        }
      }
    }
  )
)
