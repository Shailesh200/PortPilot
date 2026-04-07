import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings, Profile } from '../../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  globalShortcut: 'CommandOrControl+Shift+P',
  refreshInterval: 3000,
  darkMode: true,
  autoOpenBrowser: false,
  autoFocusTerminal: true,
  confirmDestructive: true,
  highlightCritical: true,
  protectSystemPorts: true,
  cpuThreshold: 80,
  memoryThreshold: 80,
  notifyPortChange: true,
  notifyHighCpu: true,
  notifyCrash: true
}

const DEFAULT_PROFILES: Profile[] = [
  {
    id: 'frontend',
    name: 'Frontend Dev',
    icon: '🎨',
    favoritePorts: [3000, 3001, 5173, 8080],
    filters: {},
    autoActions: {}
  },
  {
    id: 'backend',
    name: 'Backend Dev',
    icon: '⚙️',
    favoritePorts: [4000, 5000, 8000, 8080],
    filters: {},
    autoActions: {}
  }
]

interface SettingsState extends AppSettings {
  profiles: Profile[]
  activeProfileId: string | null

  updateSettings: (settings: Partial<AppSettings>) => void
  addProfile: (profile: Profile) => void
  removeProfile: (id: string) => void
  setActiveProfile: (id: string | null) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      profiles: DEFAULT_PROFILES,
      activeProfileId: null,

      updateSettings: (settings) => set((s) => ({ ...s, ...settings })),

      addProfile: (profile) =>
        set((s) => ({ profiles: [...s.profiles, profile] })),

      removeProfile: (id) =>
        set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),

      setActiveProfile: (id) => set({ activeProfileId: id }),

      resetSettings: () =>
        set({
          ...DEFAULT_SETTINGS,
          profiles: DEFAULT_PROFILES,
          activeProfileId: null
        })
    }),
    { name: 'portpilot-settings' }
  )
)
