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
  /** OS / vendor daemon — hideable on the dashboard. Not the same as isCritical. */
  isSystem: boolean
  /** Listening server vs inbound TCP client connected to a local listener. */
  role: 'listen' | 'connection'
  peerAddress: string
  peerPort: number
  /** ESTABLISHED clients currently talking to this listener. */
  connectionCount: number
  /** Best-effort runtime tag: node, docker, postgres, … */
  runtime: string
}

export interface ProcessDetails {
  pid: number
  ppid: number
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
  workspace?: ProfileWorkspace
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
  hideSystemProcesses: boolean
  cpuThreshold: number
  memoryThreshold: number
  notifyPortChange: boolean
  notifyHighCpu: boolean
  notifyCrash: boolean
  pinnedTextTools: TextToolId[]
  regexLineByLine: boolean
  jsPlaygroundAutoRun: boolean
  waitOpenBrowser: boolean
  autoUpdate: boolean
}

export type SafetySettings = Pick<
  AppSettings,
  | 'protectSystemPorts'
  | 'confirmDestructive'
  | 'autoFocusTerminal'
  | 'hideSystemProcesses'
>

export type AlertSettings = Pick<
  AppSettings,
  'notifyPortChange' | 'notifyCrash' | 'autoOpenBrowser'
>

export type ModuleId =
  | 'ports'
  | 'text'
  | 'database'
  | 'settings'

export type PortsScreen = 'dashboard' | 'heatmap'

export type TextToolId =
  | 'json-formatter'
  | 'json-diff'
  | 'js-console'
  | 'text-diff'
  | 'format-converter'
  | 'encode-decode'
  | 'jwt-inspector'
  | 'url-curl'
  | 'regex'
  | 'time'
  | 'clipboard'

export type PortView = 'listen' | 'connections'

export interface ProfileWorkspace {
  hideSystemProcesses?: boolean
  portView?: PortView
  groupByProject?: boolean
  textTool?: TextToolId
  connectionId?: string
  converterFrom?: string
  converterTo?: string
  openOnActivate?: 'ports' | 'text' | 'database'
}

export type DatabaseScreen =
  | 'connections'
  | 'tables'
  | 'sql'
  | 'query-history'

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
  | {
      module: 'database'
      screen: DatabaseScreen
      connectionId?: string
    }
  | { module: 'settings'; screen: SettingsTabId }

export const DEFAULT_NAV: NavLocation = {
  module: 'ports',
  screen: 'dashboard'
}

export interface ProfilesPersistState {
  profiles: Profile[]
  activeProfileId: string | null
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'disabled'
  | 'error'

export interface UpdateInfo {
  version: string
  currentVersion: string
  status: UpdateStatus
  message?: string
  percent?: number
  /** False in unpackaged / MAS builds — check still works, install does not. */
  canInstall: boolean
}

export type { IpcApi } from './ipc'


export type TextSnapshotTool = 'json-diff' | 'json-formatter' | 'text-diff'

export interface TextSnapshotBase {
  id: string
  label: string
  createdAt: number
  updatedAt: number
}

export interface JsonDiffSnapshot extends TextSnapshotBase {
  tool: 'json-diff'
  left: string
  right: string
  mode: 'semantic' | 'line'
  ignoreKeyOrder: boolean
}

export interface JsonFormatterSnapshot extends TextSnapshotBase {
  tool: 'json-formatter'
  input: string
  mode: 'tree' | 'raw'
  indent: '2' | '4' | '0'
  sortKeys: boolean
}

export interface TextDiffSnapshot extends TextSnapshotBase {
  tool: 'text-diff'
  left: string
  right: string
  split: boolean
}

export type TextSnapshot =
  | JsonDiffSnapshot
  | JsonFormatterSnapshot
  | TextDiffSnapshot

export type JsonDiffSnapshotInput = {
  tool: 'json-diff'
  label?: string
  left: string
  right: string
  mode: 'semantic' | 'line'
  ignoreKeyOrder: boolean
}

export type JsonFormatterSnapshotInput = {
  tool: 'json-formatter'
  label?: string
  input: string
  mode: 'tree' | 'raw'
  indent: '2' | '4' | '0'
  sortKeys: boolean
}

export type TextDiffSnapshotInput = {
  tool: 'text-diff'
  label?: string
  left: string
  right: string
  split: boolean
}

export type ClipboardKind = 'text' | 'json' | 'url' | 'color' | 'code' | 'jwt'

export interface ClipboardItem {
  id: string
  text: string
  kind: ClipboardKind
  createdAt: number
  pinned: boolean
}

export type DbEngine =
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'redis'
  | 'mongodb'
  | 'libsql'

export interface DbConnectionPublic {
  id: string
  name: string
  engine: DbEngine
  host?: string
  port?: number
  database?: string
  user?: string
  filePath?: string
  ssl?: boolean
  readOnly?: boolean
  group?: 'dev' | 'staging' | 'prod' | 'other'
  color?: string
  sshEnabled?: boolean
  sshHost?: string
  sshPort?: number
  sshUser?: string
  sshPrivateKeyPath?: string
  sshLocalPort?: number
  hasPassword?: boolean
  hasSshPassword?: boolean
}

export interface DbConnectionInput extends DbConnectionPublic {
  password?: string
  sshPassword?: string
  /** Persist to OS keychain. Default true. False = this session only. */
  savePassword?: boolean
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

export interface DbSavedQuery {
  id: string
  connectionId: string
  label: string
  sql: string
  createdAt: number
  updatedAt: number
}

export interface DbTreeObject {
  schema?: string
  name: string
  qualified: string
  kind: 'table' | 'view' | 'collection'
}

export interface DbColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string | null
  isPrimaryKey?: boolean
}

export interface DbIndexInfo {
  name: string
  columns: string[]
  unique: boolean
}

export interface DbTableSchema {
  table: string
  columns: DbColumnInfo[]
  indexes: DbIndexInfo[]
  foreignKeys: { column: string; refTable: string; refColumn: string }[]
}

export type DbAccessMode = 'read-write' | 'read-only' | 'unknown'

export interface DbAccessInfo {
  mode: DbAccessMode
  user?: string
  database?: string
  details: string[]
}
