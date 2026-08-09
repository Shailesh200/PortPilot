import type { AppSettings, Profile } from './types'

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

export const DEFAULT_SETTINGS: AppSettings = {
  // Cmd/Ctrl+Shift+P is VS Code's command palette — don't hijack it.
  globalShortcut: 'CommandOrControl+Alt+P',
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
