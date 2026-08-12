import { create } from 'zustand'
import type { NavLocation } from '../../../shared/types'
import { useUIStore } from './uiStore'

interface HandoffState {
  payload: string | null
  meta: Record<string, unknown> | null
  take: () => { payload: string | null; meta: Record<string, unknown> | null }
  navigateWithPayload: (
    nav: NavLocation,
    payload: string,
    meta?: Record<string, unknown>
  ) => void
}

export const useHandoffStore = create<HandoffState>((set, get) => ({
  payload: null,
  meta: null,

  take: () => {
    const { payload, meta } = get()
    set({ payload: null, meta: null })
    return { payload, meta }
  },

  navigateWithPayload: (nav, payload, meta) => {
    set({ payload, meta: meta ?? null })
    useUIStore.getState().setNav(nav)
  }
}))
