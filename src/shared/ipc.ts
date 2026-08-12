/**
 * Shared IPC contracts — channel names + typed invoke/event maps.
 * Preload and main should use the helpers in ipc-bridge (preload) / main/ipc-handle.
 */
import type {
  ClipboardItem,
  DbAccessInfo,
  DbConnectionInput,
  DbConnectionPublic,
  DbQueryHistoryItem,
  DbSavedQuery,
  DbTableSchema,
  DbTreeObject,
  JsonDiffSnapshotInput,
  JsonFormatterSnapshotInput,
  NavLocation,
  PortInfo,
  ProcessDetails,
  ProfilesPersistState,
  TextDiffSnapshotInput,
  TextSnapshot,
  TextSnapshotTool,
  UpdateInfo
} from './types'

export const IpcChannel = {
  getPorts: 'get-ports',
  getProcessDetails: 'get-process-details',
  killProcess: 'kill-process',
  killProcesses: 'kill-processes',
  openInBrowser: 'open-in-browser',
  openInTerminal: 'open-in-terminal',
  openInVscode: 'open-in-vscode',
  restartProcess: 'restart-process',
  updatePollInterval: 'update-poll-interval',
  updateGlobalShortcut: 'update-global-shortcut',
  updateSafetySettings: 'update-safety-settings',
  updateAlertSettings: 'update-alert-settings',
  loadProfiles: 'load-profiles',
  saveProfiles: 'save-profiles',
  getAppVersion: 'get-app-version',
  quitAndInstall: 'quit-and-install',

  windowIsFullScreen: 'window-is-full-screen',
  windowSetFullScreen: 'window-set-full-screen',
  windowToggleFullScreen: 'window-toggle-full-screen',

  clipboardGetHistory: 'clipboard-get-history',
  clipboardSetCapture: 'clipboard-set-capture',
  clipboardIsCaptureEnabled: 'clipboard-is-capture-enabled',
  clipboardPin: 'clipboard-pin',
  clipboardDelete: 'clipboard-delete',
  clipboardClear: 'clipboard-clear',
  clipboardWrite: 'clipboard-write',

  dbListConnections: 'db-list-connections',
  dbListLive: 'db-list-live',
  dbSaveConnection: 'db-save-connection',
  dbDeleteConnection: 'db-delete-connection',
  dbConnect: 'db-connect',
  dbDisconnect: 'db-disconnect',
  dbQuery: 'db-query',
  dbTables: 'db-tables',
  dbTableSchema: 'db-table-schema',
  dbBrowseTable: 'db-browse-table',
  dbAnalyzeSql: 'db-analyze-sql',
  dbExplain: 'db-explain',
  dbSavedQueries: 'db-saved-queries',
  dbSaveQuery: 'db-save-query',
  dbDeleteSavedQuery: 'db-delete-saved-query',
  dbTableDdl: 'db-table-ddl',
  dbUpdateCell: 'db-update-cell',
  dbInsertRow: 'db-insert-row',
  dbImportCsv: 'db-import-csv',
  dbRedisKeys: 'db-redis-keys',
  dbRedisKey: 'db-redis-key',
  dbHistory: 'db-history',
  dbPickSqliteFile: 'db-pick-sqlite-file',
  dbPickSshKey: 'db-pick-ssh-key',
  dbAccessInfo: 'db-access-info',

  textSnapshotsList: 'text-snapshots-list',
  textSnapshotsSave: 'text-snapshots-save',
  textSnapshotsUpdateLabel: 'text-snapshots-update-label',
  textSnapshotsDelete: 'text-snapshots-delete',
  saveTextFile: 'save-text-file',
  saveHtmlAsPdf: 'save-html-as-pdf'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

export const IpcEvent = {
  portsUpdated: 'ports-updated',
  focusSearch: 'focus-search',
  profilesChanged: 'profiles-changed',
  openProfileCreator: 'open-profile-creator',
  navigateTo: 'navigate-to',
  updateStatus: 'update-status',
  appToast: 'app-toast',
  clipboardUpdated: 'clipboard-updated',
  textSnapshotsUpdated: 'text-snapshots-updated',
  windowFullScreenChanged: 'window-full-screen-changed'
} as const

export type IpcEventName = (typeof IpcEvent)[keyof typeof IpcEvent]

type TerminalOpenResult = {
  ok: boolean
  method: 'focused-tab' | 'focused-app' | 'new-tab' | 'fallback' | 'failed'
  app: string
  message: string
}

type RestartResult = {
  success: boolean
  error?: string
  hint?: string
}

type QueryResult = {
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs: number
  error?: string
  needsConfirm?: boolean
}

type SaveFileResult =
  | { ok: true; path: string; name: string }
  | { ok: false; canceled: true }
  | { ok: false; canceled: false; error: string }

type SavePdfResult =
  | { ok: true; path: string; name: string }
  | { ok: true; preview: true; base64: string }
  | { ok: false; canceled: true }
  | { ok: false; canceled: false; error: string }

export type AppToastPayload = {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
}

/** Channel → { args, result } for ipcRenderer.invoke / ipcMain.handle */
export type InvokeMap = {
  [IpcChannel.getPorts]: { args: []; result: PortInfo[] }
  [IpcChannel.getProcessDetails]: { args: [pid: number]; result: ProcessDetails | null }
  [IpcChannel.killProcess]: { args: [pid: number, force?: boolean]; result: boolean }
  [IpcChannel.killProcesses]: {
    args: [pids: number[]]
    result: { pid: number; success: boolean }[]
  }
  [IpcChannel.openInBrowser]: { args: [port: number]; result: void }
  [IpcChannel.openInTerminal]: {
    args: [pid: number, projectPath?: string]
    result: TerminalOpenResult
  }
  [IpcChannel.openInVscode]: { args: [pid: number, projectPath?: string]; result: void }
  [IpcChannel.restartProcess]: {
    args: [pid: number, projectPath?: string]
    result: RestartResult
  }
  [IpcChannel.updatePollInterval]: { args: [intervalMs: number]; result: void }
  [IpcChannel.updateGlobalShortcut]: { args: [shortcut: string]; result: boolean }
  [IpcChannel.updateSafetySettings]: {
    args: [
      settings: {
        protectSystemPorts: boolean
        confirmDestructive: boolean
        autoFocusTerminal: boolean
      }
    ]
    result: void
  }
  [IpcChannel.updateAlertSettings]: {
    args: [
      settings: {
        notifyPortChange: boolean
        notifyCrash: boolean
        autoOpenBrowser: boolean
      }
    ]
    result: void
  }
  [IpcChannel.loadProfiles]: { args: []; result: ProfilesPersistState }
  [IpcChannel.saveProfiles]: { args: [state: ProfilesPersistState]; result: boolean }
  [IpcChannel.getAppVersion]: { args: []; result: string }
  [IpcChannel.quitAndInstall]: { args: []; result: void }

  [IpcChannel.windowIsFullScreen]: { args: []; result: boolean }
  [IpcChannel.windowSetFullScreen]: { args: [flag: boolean]; result: boolean }
  [IpcChannel.windowToggleFullScreen]: { args: []; result: boolean }

  [IpcChannel.clipboardGetHistory]: { args: []; result: ClipboardItem[] }
  [IpcChannel.clipboardSetCapture]: { args: [enabled: boolean]; result: boolean }
  [IpcChannel.clipboardIsCaptureEnabled]: { args: []; result: boolean }
  [IpcChannel.clipboardPin]: {
    args: [id: string, pinned: boolean]
    result: ClipboardItem[]
  }
  [IpcChannel.clipboardDelete]: { args: [id: string]; result: ClipboardItem[] }
  [IpcChannel.clipboardClear]: { args: [keepPinned: boolean]; result: ClipboardItem[] }
  [IpcChannel.clipboardWrite]: { args: [text: string]; result: void }

  [IpcChannel.dbListConnections]: { args: []; result: DbConnectionPublic[] }
  [IpcChannel.dbListLive]: { args: []; result: string[] }
  [IpcChannel.dbSaveConnection]: {
    args: [profile: DbConnectionInput]
    result: DbConnectionPublic[]
  }
  [IpcChannel.dbDeleteConnection]: { args: [id: string]; result: DbConnectionPublic[] }
  [IpcChannel.dbConnect]: { args: [id: string]; result: { ok: boolean; error?: string } }
  [IpcChannel.dbDisconnect]: { args: [id: string]; result: void }
  [IpcChannel.dbQuery]: {
    args: [id: string, sql: string, opts?: { allowDestructive?: boolean }]
    result: QueryResult
  }
  [IpcChannel.dbTables]: {
    args: [id: string]
    result: {
      ok: boolean
      tables?: string[]
      objects?: DbTreeObject[]
      error?: string
    }
  }
  [IpcChannel.dbTableSchema]: {
    args: [id: string, table: string]
    result: { ok: boolean; schema?: DbTableSchema; error?: string }
  }
  [IpcChannel.dbBrowseTable]: {
    args: [
      id: string,
      table: string,
      opts: { where?: string; limit?: number; offset?: number }
    ]
    result: {
      ok: boolean
      columns?: string[]
      rows?: unknown[][]
      total?: number
      durationMs: number
      error?: string
    }
  }
  [IpcChannel.dbAnalyzeSql]: {
    args: [sql: string]
    result: { mutating: boolean; destructive: boolean; statements: number }
  }
  [IpcChannel.dbExplain]: {
    args: [id: string, sql: string, analyze?: boolean]
    result: {
      ok: boolean
      columns?: string[]
      rows?: unknown[][]
      durationMs: number
      error?: string
    }
  }
  [IpcChannel.dbSavedQueries]: {
    args: [connectionId?: string]
    result: DbSavedQuery[]
  }
  [IpcChannel.dbSaveQuery]: {
    args: [
      input: {
        id?: string
        connectionId: string
        label: string
        sql: string
      }
    ]
    result: DbSavedQuery[]
  }
  [IpcChannel.dbDeleteSavedQuery]: { args: [id: string]; result: DbSavedQuery[] }
  [IpcChannel.dbTableDdl]: {
    args: [id: string, table: string]
    result: { ok: boolean; ddl?: string; error?: string }
  }
  [IpcChannel.dbUpdateCell]: {
    args: [
      id: string,
      input: {
        table: string
        pkColumn: string
        pkValue: unknown
        column: string
        value: unknown
      }
    ]
    result: { ok: boolean; durationMs: number; error?: string }
  }
  [IpcChannel.dbInsertRow]: {
    args: [
      id: string,
      input: { table: string; columns: string[]; values: unknown[] }
    ]
    result: { ok: boolean; durationMs: number; error?: string }
  }
  [IpcChannel.dbImportCsv]: {
    args: [
      id: string,
      input: {
        table: string
        columns: string[]
        rows: unknown[][]
        batchSize?: number
      }
    ]
    result: {
      ok: boolean
      inserted: number
      durationMs: number
      error?: string
    }
  }
  [IpcChannel.dbRedisKeys]: {
    args: [id: string, opts?: { pattern?: string; count?: number }]
    result: QueryResult
  }
  [IpcChannel.dbRedisKey]: { args: [id: string, key: string]; result: QueryResult }
  [IpcChannel.dbHistory]: {
    args: [connectionId?: string]
    result: DbQueryHistoryItem[]
  }
  [IpcChannel.dbPickSqliteFile]: { args: []; result: string | null }
  [IpcChannel.dbPickSshKey]: { args: []; result: string | null }
  [IpcChannel.dbAccessInfo]: {
    args: [id: string]
    result: { ok: boolean; info?: DbAccessInfo; error?: string }
  }

  [IpcChannel.textSnapshotsList]: {
    args: [tool?: TextSnapshotTool]
    result: TextSnapshot[]
  }
  [IpcChannel.textSnapshotsSave]: {
    args: [
      input:
        | JsonDiffSnapshotInput
        | JsonFormatterSnapshotInput
        | TextDiffSnapshotInput
    ]
    result: TextSnapshot[]
  }
  [IpcChannel.textSnapshotsUpdateLabel]: {
    args: [id: string, label: string]
    result: TextSnapshot[]
  }
  [IpcChannel.textSnapshotsDelete]: { args: [id: string]; result: TextSnapshot[] }
  [IpcChannel.saveTextFile]: {
    args: [
      payload: {
        content: string
        defaultName?: string
        encoding?: 'utf8' | 'base64'
        filters?: { name: string; extensions: string[] }[]
      }
    ]
    result: SaveFileResult
  }
  [IpcChannel.saveHtmlAsPdf]: {
    args: [
      payload: {
        html: string
        defaultName?: string
        preview?: boolean
      }
    ]
    result: SavePdfResult
  }
}

/** Main → renderer push payloads */
export type EventMap = {
  [IpcEvent.portsUpdated]: PortInfo[]
  [IpcEvent.focusSearch]: undefined
  [IpcEvent.profilesChanged]: undefined
  [IpcEvent.openProfileCreator]: undefined
  [IpcEvent.navigateTo]: NavLocation
  [IpcEvent.updateStatus]: UpdateInfo
  [IpcEvent.appToast]: AppToastPayload
  [IpcEvent.clipboardUpdated]: ClipboardItem[]
  [IpcEvent.textSnapshotsUpdated]: TextSnapshot[]
  [IpcEvent.windowFullScreenChanged]: boolean
}

export type InvokeChannel = keyof InvokeMap
export type EventChannel = keyof EventMap
