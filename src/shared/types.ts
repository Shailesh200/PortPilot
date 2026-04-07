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

export type ViewType = 'dashboard' | 'heatmap' | 'logs' | 'settings'

export interface IpcApi {
  getPorts: () => Promise<PortInfo[]>
  getProcessDetails: (pid: number) => Promise<ProcessDetails | null>
  getProcessLogs: (pid: number) => Promise<string[]>
  killProcess: (pid: number, force?: boolean) => Promise<boolean>
  killProcesses: (pids: number[]) => Promise<{ pid: number; success: boolean }[]>
  openInBrowser: (port: number) => Promise<void>
  openInTerminal: (pid: number, projectPath?: string) => Promise<void>
  openInVSCode: (pid: number, projectPath?: string) => Promise<void>
  restartProcess: (pid: number, projectPath?: string) => Promise<{ success: boolean; error?: string }>
  updatePollInterval: (intervalMs: number) => Promise<void>
  updateGlobalShortcut: (shortcut: string) => Promise<boolean>
  onPortsUpdate: (callback: (ports: PortInfo[]) => void) => () => void
  onFocusSearch: (callback: () => void) => () => void
}
