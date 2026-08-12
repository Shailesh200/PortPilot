import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcApi,
  PortInfo,
  ProfilesPersistState,
  UpdateInfo,
  ClipboardItem,
  TextSnapshot,
  NavLocation
} from '../shared/types'

const api: IpcApi = {
  getPorts: () => ipcRenderer.invoke('get-ports'),
  getProcessDetails: (pid: number) => ipcRenderer.invoke('get-process-details', pid),
  killProcess: (pid: number, force?: boolean) =>
    ipcRenderer.invoke('kill-process', pid, force),
  killProcesses: (pids: number[]) => ipcRenderer.invoke('kill-processes', pids),
  openInBrowser: (port: number) => ipcRenderer.invoke('open-in-browser', port),
  openInTerminal: (pid: number, projectPath?: string) =>
    ipcRenderer.invoke('open-in-terminal', pid, projectPath),
  openInVSCode: (pid: number, projectPath?: string) =>
    ipcRenderer.invoke('open-in-vscode', pid, projectPath),
  restartProcess: (pid: number, projectPath?: string) =>
    ipcRenderer.invoke('restart-process', pid, projectPath),
  updatePollInterval: (intervalMs: number) =>
    ipcRenderer.invoke('update-poll-interval', intervalMs),
  updateGlobalShortcut: (shortcut: string) =>
    ipcRenderer.invoke('update-global-shortcut', shortcut),
  updateSafetySettings: (settings) =>
    ipcRenderer.invoke('update-safety-settings', settings),
  updateAlertSettings: (settings) =>
    ipcRenderer.invoke('update-alert-settings', settings),
  loadProfiles: () => ipcRenderer.invoke('load-profiles'),
  saveProfiles: (state: ProfilesPersistState) =>
    ipcRenderer.invoke('save-profiles', state),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onPortsUpdate: (callback: (ports: PortInfo[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ports: PortInfo[]) =>
      callback(ports)
    ipcRenderer.on('ports-updated', handler)
    return () => {
      ipcRenderer.removeListener('ports-updated', handler)
    }
  },
  onFocusSearch: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('focus-search', handler)
    return () => {
      ipcRenderer.removeListener('focus-search', handler)
    }
  },
  onProfilesChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('profiles-changed', handler)
    return () => {
      ipcRenderer.removeListener('profiles-changed', handler)
    }
  },
  onOpenProfileCreator: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('open-profile-creator', handler)
    return () => {
      ipcRenderer.removeListener('open-profile-creator', handler)
    }
  },
  onNavigateTo: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, nav: NavLocation) =>
      callback(nav)
    ipcRenderer.on('navigate-to', handler)
    return () => {
      ipcRenderer.removeListener('navigate-to', handler)
    }
  },
  onUpdateStatus: (callback: (info: UpdateInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info)
    ipcRenderer.on('update-status', handler)
    return () => {
      ipcRenderer.removeListener('update-status', handler)
    }
  },
  onAppToast: (callback) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      toast: {
        type: 'success' | 'error' | 'warning' | 'info'
        title: string
        message?: string
      }
    ) => callback(toast)
    ipcRenderer.on('app-toast', handler)
    return () => {
      ipcRenderer.removeListener('app-toast', handler)
    }
  },

  clipboardGetHistory: () => ipcRenderer.invoke('clipboard-get-history'),
  clipboardSetCapture: (enabled) =>
    ipcRenderer.invoke('clipboard-set-capture', enabled),
  clipboardIsCaptureEnabled: () =>
    ipcRenderer.invoke('clipboard-is-capture-enabled'),
  clipboardPin: (id, pinned) => ipcRenderer.invoke('clipboard-pin', id, pinned),
  clipboardDelete: (id) => ipcRenderer.invoke('clipboard-delete', id),
  clipboardClear: (keepPinned) =>
    ipcRenderer.invoke('clipboard-clear', keepPinned),
  clipboardWrite: (text) => ipcRenderer.invoke('clipboard-write', text),
  onClipboardUpdate: (callback) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      items: ClipboardItem[]
    ) => callback(items)
    ipcRenderer.on('clipboard-updated', handler)
    return () => ipcRenderer.removeListener('clipboard-updated', handler)
  },

  dbListConnections: () => ipcRenderer.invoke('db-list-connections'),
  dbListLive: () => ipcRenderer.invoke('db-list-live'),
  dbSaveConnection: (profile) =>
    ipcRenderer.invoke('db-save-connection', profile),
  dbDeleteConnection: (id) => ipcRenderer.invoke('db-delete-connection', id),
  dbConnect: (id) => ipcRenderer.invoke('db-connect', id),
  dbDisconnect: (id) => ipcRenderer.invoke('db-disconnect', id),
  dbQuery: (id, sql, opts) => ipcRenderer.invoke('db-query', id, sql, opts),
  dbTables: (id) => ipcRenderer.invoke('db-tables', id),
  dbTableSchema: (id, table) =>
    ipcRenderer.invoke('db-table-schema', id, table),
  dbBrowseTable: (id, table, opts) =>
    ipcRenderer.invoke('db-browse-table', id, table, opts),
  dbAnalyzeSql: (sql) => ipcRenderer.invoke('db-analyze-sql', sql),
  dbExplain: (id, sql, analyze) =>
    ipcRenderer.invoke('db-explain', id, sql, analyze),
  dbSavedQueries: (connectionId) =>
    ipcRenderer.invoke('db-saved-queries', connectionId),
  dbSaveQuery: (input) => ipcRenderer.invoke('db-save-query', input),
  dbDeleteSavedQuery: (id) => ipcRenderer.invoke('db-delete-saved-query', id),
  dbTableDdl: (id, table) => ipcRenderer.invoke('db-table-ddl', id, table),
  dbUpdateCell: (id, input) => ipcRenderer.invoke('db-update-cell', id, input),
  dbInsertRow: (id, input) => ipcRenderer.invoke('db-insert-row', id, input),
  dbImportCsv: (id, input) => ipcRenderer.invoke('db-import-csv', id, input),
  dbRedisKeys: (id, opts) => ipcRenderer.invoke('db-redis-keys', id, opts),
  dbRedisKey: (id, key) => ipcRenderer.invoke('db-redis-key', id, key),
  dbHistory: (connectionId) => ipcRenderer.invoke('db-history', connectionId),
  dbPickSqliteFile: () => ipcRenderer.invoke('db-pick-sqlite-file'),
  dbPickSshKey: () => ipcRenderer.invoke('db-pick-ssh-key'),
  dbGetAccessInfo: (id) => ipcRenderer.invoke('db-access-info', id),

  windowIsFullScreen: () => ipcRenderer.invoke('window-is-full-screen'),
  windowSetFullScreen: (flag) =>
    ipcRenderer.invoke('window-set-full-screen', flag),
  windowToggleFullScreen: () => ipcRenderer.invoke('window-toggle-full-screen'),
  onWindowFullScreenChange: (callback) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      isFullScreen: boolean
    ) => callback(isFullScreen)
    ipcRenderer.on('window-full-screen-changed', handler)
    return () =>
      ipcRenderer.removeListener('window-full-screen-changed', handler)
  },

  textSnapshotsList: (tool) => ipcRenderer.invoke('text-snapshots-list', tool),
  textSnapshotsSave: (input) => ipcRenderer.invoke('text-snapshots-save', input),
  textSnapshotsUpdateLabel: (id, label) =>
    ipcRenderer.invoke('text-snapshots-update-label', id, label),
  textSnapshotsDelete: (id) => ipcRenderer.invoke('text-snapshots-delete', id),
  onTextSnapshotsUpdate: (callback) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      items: TextSnapshot[]
    ) => callback(items)
    ipcRenderer.on('text-snapshots-updated', handler)
    return () => ipcRenderer.removeListener('text-snapshots-updated', handler)
  },

  saveTextFile: (payload) => ipcRenderer.invoke('save-text-file', payload),
  saveHtmlAsPdf: (payload) => ipcRenderer.invoke('save-html-as-pdf', payload)
}

contextBridge.exposeInMainWorld('api', api)
