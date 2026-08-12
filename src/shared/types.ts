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
  | 'clipboard'

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

export interface UpdateInfo {
  version: string
  status: 'available' | 'downloaded' | 'error'
  message?: string
}

export interface IpcApi {
  getPorts: () => Promise<PortInfo[]>
  getProcessDetails: (pid: number) => Promise<ProcessDetails | null>
  killProcess: (pid: number, force?: boolean) => Promise<boolean>
  killProcesses: (pids: number[]) => Promise<{ pid: number; success: boolean }[]>
  openInBrowser: (port: number) => Promise<void>
  openInTerminal: (pid: number, projectPath?: string) => Promise<{
    ok: boolean
    method: 'focused-tab' | 'focused-app' | 'new-tab' | 'fallback' | 'failed'
    app: string
    message: string
  }>
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
    autoFocusTerminal: boolean
  }) => Promise<void>
  updateAlertSettings: (settings: {
    notifyPortChange: boolean
    notifyCrash: boolean
    autoOpenBrowser: boolean
  }) => Promise<void>
  onAppToast: (
    callback: (toast: {
      type: 'success' | 'error' | 'warning' | 'info'
      title: string
      message?: string
    }) => void
  ) => () => void
  loadProfiles: () => Promise<ProfilesPersistState>
  saveProfiles: (state: ProfilesPersistState) => Promise<boolean>
  getAppVersion: () => Promise<string>
  quitAndInstall: () => Promise<void>
  onPortsUpdate: (callback: (ports: PortInfo[]) => void) => () => void
  onFocusSearch: (callback: () => void) => () => void
  onProfilesChanged: (callback: () => void) => () => void
  onOpenProfileCreator: (callback: () => void) => () => void
  onNavigateTo: (callback: (nav: NavLocation) => void) => () => void
  onUpdateStatus: (callback: (info: UpdateInfo) => void) => () => void

  // Clipboard
  clipboardGetHistory: () => Promise<ClipboardItem[]>
  clipboardSetCapture: (enabled: boolean) => Promise<boolean>
  clipboardIsCaptureEnabled: () => Promise<boolean>
  clipboardPin: (id: string, pinned: boolean) => Promise<ClipboardItem[]>
  clipboardDelete: (id: string) => Promise<ClipboardItem[]>
  clipboardClear: (keepPinned: boolean) => Promise<ClipboardItem[]>
  clipboardWrite: (text: string) => Promise<void>
  onClipboardUpdate: (callback: (items: ClipboardItem[]) => void) => () => void

  // Database
  dbListConnections: () => Promise<DbConnectionPublic[]>
  dbListLive: () => Promise<string[]>
  dbSaveConnection: (profile: DbConnectionInput) => Promise<DbConnectionPublic[]>
  dbDeleteConnection: (id: string) => Promise<DbConnectionPublic[]>
  dbConnect: (id: string) => Promise<{ ok: boolean; error?: string }>
  dbDisconnect: (id: string) => Promise<void>
  dbQuery: (
    id: string,
    sql: string,
    opts?: { allowDestructive?: boolean }
  ) => Promise<{
    ok: boolean
    columns?: string[]
    rows?: unknown[][]
    durationMs: number
    error?: string
    needsConfirm?: boolean
  }>
  dbTables: (
    id: string
  ) => Promise<{
    ok: boolean
    tables?: string[]
    objects?: DbTreeObject[]
    error?: string
  }>
  dbTableSchema: (
    id: string,
    table: string
  ) => Promise<{ ok: boolean; schema?: DbTableSchema; error?: string }>
  dbBrowseTable: (
    id: string,
    table: string,
    opts: { where?: string; limit?: number; offset?: number }
  ) => Promise<{
    ok: boolean
    columns?: string[]
    rows?: unknown[][]
    total?: number
    durationMs: number
    error?: string
  }>
  dbAnalyzeSql: (sql: string) => Promise<{
    mutating: boolean
    destructive: boolean
    statements: number
  }>
  dbExplain: (
    id: string,
    sql: string,
    analyze?: boolean
  ) => Promise<{
    ok: boolean
    columns?: string[]
    rows?: unknown[][]
    durationMs: number
    error?: string
  }>
  dbSavedQueries: (connectionId?: string) => Promise<DbSavedQuery[]>
  dbSaveQuery: (input: {
    id?: string
    connectionId: string
    label: string
    sql: string
  }) => Promise<DbSavedQuery[]>
  dbDeleteSavedQuery: (id: string) => Promise<DbSavedQuery[]>
  dbTableDdl: (
    id: string,
    table: string
  ) => Promise<{ ok: boolean; ddl?: string; error?: string }>
  dbUpdateCell: (
    id: string,
    input: {
      table: string
      pkColumn: string
      pkValue: unknown
      column: string
      value: unknown
    }
  ) => Promise<{ ok: boolean; durationMs: number; error?: string }>
  dbInsertRow: (
    id: string,
    input: { table: string; columns: string[]; values: unknown[] }
  ) => Promise<{ ok: boolean; durationMs: number; error?: string }>
  dbImportCsv: (
    id: string,
    input: {
      table: string
      columns: string[]
      rows: unknown[][]
      batchSize?: number
    }
  ) => Promise<{
    ok: boolean
    inserted: number
    durationMs: number
    error?: string
  }>
  dbRedisKeys: (
    id: string,
    opts?: { pattern?: string; count?: number }
  ) => Promise<{
    ok: boolean
    columns?: string[]
    rows?: unknown[][]
    durationMs: number
    error?: string
  }>
  dbRedisKey: (
    id: string,
    key: string
  ) => Promise<{
    ok: boolean
    columns?: string[]
    rows?: unknown[][]
    durationMs: number
    error?: string
  }>
  dbHistory: (connectionId?: string) => Promise<DbQueryHistoryItem[]>
  dbPickSqliteFile: () => Promise<string | null>
  dbPickSshKey: () => Promise<string | null>
  dbGetAccessInfo: (id: string) => Promise<{
    ok: boolean
    info?: DbAccessInfo
    error?: string
  }>

  // Window
  windowIsFullScreen: () => Promise<boolean>
  windowSetFullScreen: (flag: boolean) => Promise<boolean>
  windowToggleFullScreen: () => Promise<boolean>
  onWindowFullScreenChange: (callback: (isFullScreen: boolean) => void) => () => void

  // Text tool snapshots (JSON Diff / Formatter / Text Diff)
  textSnapshotsList: (tool?: TextSnapshotTool) => Promise<TextSnapshot[]>
  textSnapshotsSave: (
    input:
      | JsonDiffSnapshotInput
      | JsonFormatterSnapshotInput
      | TextDiffSnapshotInput
  ) => Promise<TextSnapshot[]>
  textSnapshotsUpdateLabel: (
    id: string,
    label: string
  ) => Promise<TextSnapshot[]>
  textSnapshotsDelete: (id: string) => Promise<TextSnapshot[]>
  onTextSnapshotsUpdate: (
    callback: (items: TextSnapshot[]) => void
  ) => () => void

  /** Native save dialog + write. Use encoding base64 for binary formats. */
  saveTextFile: (payload: {
    content: string
    defaultName?: string
    encoding?: 'utf8' | 'base64'
    filters?: { name: string; extensions: string[] }[]
  }) => Promise<
    | { ok: true; path: string; name: string }
    | { ok: false; canceled: true }
    | { ok: false; canceled: false; error: string }
  >

  /** Render HTML → PDF. With preview:true returns base64 (no dialog); otherwise save dialog. */
  saveHtmlAsPdf: (payload: {
    html: string
    defaultName?: string
    preview?: boolean
  }) => Promise<
    | { ok: true; path: string; name: string }
    | { ok: true; preview: true; base64: string }
    | { ok: false; canceled: true }
    | { ok: false; canceled: false; error: string }
  >
}

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
}

export interface DbConnectionInput extends DbConnectionPublic {
  password?: string
  sshPassword?: string
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
