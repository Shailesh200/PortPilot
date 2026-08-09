import { create } from 'zustand'
import type { ModuleId, NavLocation, Toast } from '../../../shared/types'
import { DEFAULT_NAV } from '../../../shared/types'

interface UIState {
  nav: NavLocation
  navStack: NavLocation[]
  isCommandPaletteOpen: boolean
  isQuickPeekOpen: boolean
  quickPeekPid: number | null
  isSidebarCollapsed: boolean
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
  /** @deprecated use setNav / openModule */
  setView: (view: string) => void
  toggleCommandPalette: () => void
  closeCommandPalette: () => void
  openQuickPeek: (pid: number) => void
  closeQuickPeek: () => void
  toggleSidebar: () => void
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
    case 'clipboard':
      return { module: 'clipboard', screen: 'history' }
    case 'database':
      return { module: 'database', screen: 'connections' }
    case 'git':
      return { module: 'git', screen: 'changes' }
    case 'settings':
      return { module: 'settings', screen: 'general' }
  }
}

/** Map legacy view ids to NavLocation for transitional call sites */
function legacyViewToNav(view: string): NavLocation {
  switch (view) {
    case 'dashboard':
      return { module: 'ports', screen: 'dashboard' }
    case 'heatmap':
      return { module: 'ports', screen: 'heatmap' }
    case 'logs':
      return { module: 'ports', screen: 'logs' }
    case 'settings':
      return { module: 'settings', screen: 'general' }
    case 'ports':
    case 'text':
    case 'clipboard':
    case 'database':
    case 'git':
      return defaultForModule(view)
    default:
      return DEFAULT_NAV
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  nav: DEFAULT_NAV,
  navStack: [],
  isCommandPaletteOpen: false,
  isQuickPeekOpen: false,
  quickPeekPid: null,
  isSidebarCollapsed: false,
  toasts: [],
  expandedRows: new Set(),
  confirmDialog: null,

  setNav: (nav, pushStack = true) =>
    set((s) => ({
      nav,
      navStack: pushStack
        ? [...s.navStack.slice(-7), s.nav]
        : s.navStack
    })),

  goBack: () =>
    set((s) => {
      if (s.navStack.length === 0) return s
      const stack = [...s.navStack]
      const prev = stack.pop()!
      return { nav: prev, navStack: stack }
    }),

  openModule: (module) => {
    get().setNav(defaultForModule(module))
  },

  setView: (view) => {
    get().setNav(legacyViewToNav(view))
  },

  toggleCommandPalette: () =>
    set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),

  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  openQuickPeek: (pid) =>
    set({ isQuickPeekOpen: true, quickPeekPid: pid }),

  closeQuickPeek: () =>
    set({ isQuickPeekOpen: false, quickPeekPid: null }),

  toggleSidebar: () =>
    set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),

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
}))
