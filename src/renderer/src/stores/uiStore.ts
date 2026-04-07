import { create } from 'zustand'
import type { ViewType, Toast } from '../../../shared/types'

interface UIState {
  currentView: ViewType
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

  setView: (view: ViewType) => void
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

export const useUIStore = create<UIState>((set, get) => ({
  currentView: 'dashboard',
  isCommandPaletteOpen: false,
  isQuickPeekOpen: false,
  quickPeekPid: null,
  isSidebarCollapsed: false,
  toasts: [],
  expandedRows: new Set(),
  confirmDialog: null,

  setView: (view) => set({ currentView: view }),

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
    setTimeout(() => get().removeToast(id), toast.duration || 4000)
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
