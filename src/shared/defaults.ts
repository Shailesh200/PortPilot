import type { AppSettings, Profile } from './types'

/** No stock profiles — users create their own from Settings or the port actions menu. */
export const DEFAULT_PROFILES: Profile[] = []

/** Legacy ids shipped in older builds; stripped on load so they don't linger. */
export const LEGACY_DEFAULT_PROFILE_IDS = new Set(['frontend', 'backend'])

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
  hideSystemProcesses: true,
  cpuThreshold: 80,
  memoryThreshold: 80,
  notifyPortChange: true,
  notifyHighCpu: true,
  notifyCrash: true,
  pinnedTextTools: [],
  regexLineByLine: true,
  jsPlaygroundAutoRun: true,
  waitOpenBrowser: true,
  autoUpdate: true
}
