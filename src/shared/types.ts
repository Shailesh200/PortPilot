export interface PortInfo {
  port: number
  pid: number
  command: string
  projectName: string
  projectPath: string
  user: string
  protocol: 'TCP' | 'UDP'
  address: string
  state: string
  cpu: number
  memory: number
  memoryRSS: number
  tags: string[]
  isSelected: boolean
  isCritical: boolean
}

export interface ProcessDetails {
  pid: number
  command: string
  fullCommand: string
  user: string
  cpu: number
  memory: number
  memoryRSS: number
  uptime: string
  children: number[]
  ports: number[]
}

export interface ActionHistoryItem {
  id: string
  action: 'kill' | 'restart' | 'open-browser' | 'open-terminal' | 'open-vscode'
  port?: number
  pid?: number
  command?: string
  timestamp: number
}

export interface Profile {
  id: string
  name: string
  icon: string
  favoritePorts: number[]
  filters: Record<string, string>
  autoActions: Record<string, boolean>
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
}

export interface AppSettings {
  globalShortcut: string
  refreshInterval: number
  darkMode: boolean
  autoOpenBrowser: boolean
  autoFocusTerminal: boolean
  confirmDestructive: boolean
  highlightCritical: boolean
  protectSystemPorts: boolean
  cpuThreshold: number
  memoryThreshold: number
  notifyPortChange: boolean
  notifyHighCpu: boolean
  notifyCrash: boolean
}

/** @deprecated Prefer ModuleId + NavLocation — kept for gradual migration */
export type ViewType = 'dashboard' | 'heatmap' | 'logs' | 'settings'

export type ModuleId =
  | 'ports'
  | 'text'
  | 'clipboard'
  | 'database'
  | 'git'
  | 'settings'

export type PortsScreen = 'dashboard' | 'heatmap' | 'logs'

export type TextToolId =
  | 'json-formatter'
  | 'json-diff'
  | 'jq-playground'
  | 'text-diff'
  | 'format-converter'
  | 'csv-viewer'
  | 'regex-tester'
  | 'markdown-preview'
  | 'escape-unescape'
  | 'unicode-inspector'
  | 'fake-data'

export type ClipboardScreen = 'history' | 'transforms'

export type DatabaseScreen =
  | 'connections'
  | 'tables'
  | 'sql'
  | 'query-history'

export type GitScreen =
  | 'changes'
  | 'branches'
  | 'history'
  | 'stash'
  | 'blame'

export type SettingsTabId =
  | 'general'
  | 'appearance'
  | 'shortcuts'
  | 'notifications'
  | 'safety'
  | 'profiles'

export type NavLocation =
  | { module: 'ports'; screen: PortsScreen }
  | { module: 'text'; screen: 'landing' | TextToolId }
  | { module: 'clipboard'; screen: ClipboardScreen }
  | {
      module: 'database'
      screen: DatabaseScreen
      connectionId?: string
    }
  | { module: 'git'; screen: GitScreen; repoPath?: string }
  | { module: 'settings'; screen: SettingsTabId }

export const DEFAULT_NAV: NavLocation = {
  module: 'ports',
  screen: 'dashboard'
}

export interface ProfilesPersistState {
  profiles: Profile[]
  activeProfileId: string | null
}

export interface UpdateInfo {
  version: string
  status: 'available' | 'downloaded' | 'error'
  message?: string
}

export interface IpcApi {
  getPorts: () => Promise<PortInfo[]>
  getProcessDetails: (pid: number) => Promise<ProcessDetails | null>
  getProcessLogs: (pid: number) => Promise<string[]>
  killProcess: (pid: number, force?: boolean) => Promise<boolean>
  killProcesses: (pids: number[]) => Promise<{ pid: number; success: boolean }[]>
  openInBrowser: (port: number) => Promise<void>
  openInTerminal: (pid: number, projectPath?: string) => Promise<void>
  openInVSCode: (pid: number, projectPath?: string) => Promise<void>
  restartProcess: (pid: number, projectPath?: string) => Promise<{
    success: boolean
    error?: string
    hint?: string
  }>
  updatePollInterval: (intervalMs: number) => Promise<void>
  updateGlobalShortcut: (shortcut: string) => Promise<boolean>
  updateSafetySettings: (settings: {
    protectSystemPorts: boolean
    confirmDestructive: boolean
  }) => Promise<void>
  loadProfiles: () => Promise<ProfilesPersistState>
  saveProfiles: (state: ProfilesPersistState) => Promise<boolean>
  getAppVersion: () => Promise<string>
  quitAndInstall: () => Promise<void>
  onPortsUpdate: (callback: (ports: PortInfo[]) => void) => () => void
  onFocusSearch: (callback: () => void) => () => void
  onProfilesChanged: (callback: () => void) => () => void
  onUpdateStatus: (callback: (info: UpdateInfo) => void) => () => void

  // Clipboard
  clipboardGetHistory: () => Promise<ClipboardItem[]>
  clipboardSetCapture: (enabled: boolean) => Promise<boolean>
  clipboardIsCaptureEnabled: () => Promise<boolean>
  clipboardPin: (id: string, pinned: boolean) => Promise<ClipboardItem[]>
  clipboardClear: (keepPinned: boolean) => Promise<ClipboardItem[]>
  clipboardWrite: (text: string) => Promise<void>
  onClipboardUpdate: (callback: (items: ClipboardItem[]) => void) => () => void

  // Git
  gitAvailable: () => Promise<boolean>
  gitPickRepo: () => Promise<string | null>
  gitResolveRoot: (cwd: string) => Promise<string | null>
  gitStatus: (cwd: string) => Promise<unknown>
  gitDiff: (cwd: string, file?: string, staged?: boolean) => Promise<string>
  gitStage: (cwd: string, files: string[]) => Promise<void>
  gitUnstage: (cwd: string, files: string[]) => Promise<void>
  gitCommit: (cwd: string, message: string) => Promise<string>
  gitBranches: (cwd: string) => Promise<unknown>
  gitCheckout: (cwd: string, branch: string) => Promise<void>
  gitLog: (cwd: string) => Promise<unknown>
  gitShow: (cwd: string, hash: string) => Promise<string>
  gitStashList: (cwd: string) => Promise<unknown>
  gitStashApply: (cwd: string, index: number) => Promise<void>
  gitStashPop: (cwd: string, index: number) => Promise<void>
  gitStashDrop: (cwd: string, index: number) => Promise<void>
  gitBlame: (cwd: string, file: string) => Promise<string>

  // Database
  dbListConnections: () => Promise<DbConnectionPublic[]>
  dbSaveConnection: (profile: DbConnectionInput) => Promise<DbConnectionPublic[]>
  dbDeleteConnection: (id: string) => Promise<DbConnectionPublic[]>
  dbConnect: (id: string) => Promise<{ ok: boolean; error?: string }>
  dbDisconnect: (id: string) => Promise<void>
  dbQuery: (
    id: string,
    sql: string
  ) => Promise<{
    ok: boolean
    columns?: string[]
    rows?: unknown[][]
    durationMs: number
    error?: string
  }>
  dbTables: (
    id: string
  ) => Promise<{ ok: boolean; tables?: string[]; error?: string }>
  dbHistory: (connectionId?: string) => Promise<DbQueryHistoryItem[]>
  dbPickSqliteFile: () => Promise<string | null>
}

export interface ClipboardItem {
  id: string
  text: string
  kind: 'text' | 'json' | 'url' | 'color' | 'code' | 'jwt'
  createdAt: number
  pinned: boolean
}

export interface DbConnectionPublic {
  id: string
  name: string
  engine: 'postgres' | 'mysql' | 'sqlite' | 'redis'
  host?: string
  port?: number
  database?: string
  user?: string
  filePath?: string
  ssl?: boolean
}

export interface DbConnectionInput extends DbConnectionPublic {
  password?: string
}

export interface DbQueryHistoryItem {
  id: string
  connectionId: string
  sql: string
  createdAt: number
  durationMs?: number
  ok: boolean
  error?: string
}
