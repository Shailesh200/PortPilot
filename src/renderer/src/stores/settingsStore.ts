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

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: 'frontend',
    name: 'Frontend',
    icon: '🎨',
    favoritePorts: [5173, 3000, 4321, 5174],
    filters: {},
    autoActions: {}
  },
  {
    id: 'backend',
    name: 'Backend',
    icon: '⚙️',
    favoritePorts: [8000, 5000, 4000, 5432],
    filters: {},
    autoActions: {}
  }
]

function saveProfilesToDisk(profiles: Profile[], activeProfileId: string | null): void {
  if (typeof window !== 'undefined' && window.api?.saveProfiles) {
    void window.api.saveProfiles({ profiles, activeProfileId })
  }
}

interface SettingsState extends AppSettings {
  profiles: Profile[]
  activeProfileId: string | null

  updateSettings: (settings: Partial<AppSettings>) => void
  addProfile: (profile: Profile) => void
  removeProfile: (id: string) => void
  setActiveProfile: (id: string | null) => void
  addPortToProfile: (profileId: string, port: number) => void
  applyLoadedProfiles: (
    profiles: Profile[],
    activeProfileId: string | null
  ) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      profiles: DEFAULT_PROFILES,
      activeProfileId: null,

      updateSettings: (settings) => set((s) => ({ ...s, ...settings })),

      addProfile: (profile) =>
        set((s) => {
          const profiles = [...s.profiles, profile]
          saveProfilesToDisk(profiles, s.activeProfileId)
          return { profiles }
        }),

      removeProfile: (id) =>
        set((s) => {
          const profiles = s.profiles.filter((p) => p.id !== id)
          const activeProfileId =
            s.activeProfileId === id ? null : s.activeProfileId
          saveProfilesToDisk(profiles, activeProfileId)
          return { profiles, activeProfileId }
        }),

      setActiveProfile: (id) =>
        set((s) => {
          saveProfilesToDisk(s.profiles, id)
          return { activeProfileId: id }
        }),

      addPortToProfile: (profileId, port) =>
        set((s) => {
          const profiles = s.profiles.map((p) =>
            p.id === profileId && !p.favoritePorts.includes(port)
              ? {
                  ...p,
                  favoritePorts: [...p.favoritePorts, port].sort((a, b) => a - b)
                }
              : p
          )
          saveProfilesToDisk(profiles, s.activeProfileId)
          return { profiles }
        }),

      applyLoadedProfiles: (profiles, activeProfileId) =>
        set({ profiles, activeProfileId }),

      resetSettings: () => {
        set({
          ...DEFAULT_SETTINGS,
          profiles: DEFAULT_PROFILES,
          activeProfileId: null
        })
        saveProfilesToDisk(DEFAULT_PROFILES, null)
      }
    }),
    {
      name: 'portpilot-settings',
      partialize: (s) => ({
        globalShortcut: s.globalShortcut,
        refreshInterval: s.refreshInterval,
        darkMode: s.darkMode,
        autoOpenBrowser: s.autoOpenBrowser,
        autoFocusTerminal: s.autoFocusTerminal,
        confirmDestructive: s.confirmDestructive,
        highlightCritical: s.highlightCritical,
        protectSystemPorts: s.protectSystemPorts,
        cpuThreshold: s.cpuThreshold,
        memoryThreshold: s.memoryThreshold,
        notifyPortChange: s.notifyPortChange,
        notifyHighCpu: s.notifyHighCpu,
        notifyCrash: s.notifyCrash
      })
    }
  )
)
