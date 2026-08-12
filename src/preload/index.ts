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
import { IpcChannel, IpcEvent } from '../shared/ipc'

const api: IpcApi = {
  getPorts: () => ipcRenderer.invoke(IpcChannel.getPorts),
  getProcessDetails: (pid: number) => ipcRenderer.invoke(IpcChannel.getProcessDetails, pid),
  killProcess: (pid: number, force?: boolean) =>
    ipcRenderer.invoke(IpcChannel.killProcess, pid, force),
  killProcesses: (pids: number[]) => ipcRenderer.invoke(IpcChannel.killProcesses, pids),
  openInBrowser: (port: number) => ipcRenderer.invoke(IpcChannel.openInBrowser, port),
  openInTerminal: (pid: number, projectPath?: string) =>
    ipcRenderer.invoke(IpcChannel.openInTerminal, pid, projectPath),
  openInVSCode: (pid: number, projectPath?: string) =>
    ipcRenderer.invoke(IpcChannel.openInVscode, pid, projectPath),
  restartProcess: (pid: number, projectPath?: string) =>
    ipcRenderer.invoke(IpcChannel.restartProcess, pid, projectPath),
  updatePollInterval: (intervalMs: number) =>
    ipcRenderer.invoke(IpcChannel.updatePollInterval, intervalMs),
  updateGlobalShortcut: (shortcut: string) =>
    ipcRenderer.invoke(IpcChannel.updateGlobalShortcut, shortcut),
  updateSafetySettings: (settings) =>
    ipcRenderer.invoke(IpcChannel.updateSafetySettings, settings),
  updateAlertSettings: (settings) =>
    ipcRenderer.invoke(IpcChannel.updateAlertSettings, settings),
  loadProfiles: () => ipcRenderer.invoke(IpcChannel.loadProfiles),
  saveProfiles: (state: ProfilesPersistState) =>
    ipcRenderer.invoke(IpcChannel.saveProfiles, state),
  getAppVersion: () => ipcRenderer.invoke(IpcChannel.getAppVersion),
  quitAndInstall: () => ipcRenderer.invoke(IpcChannel.quitAndInstall),
  onPortsUpdate: (callback: (ports: PortInfo[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ports: PortInfo[]) =>
      callback(ports)
    ipcRenderer.on(IpcEvent.portsUpdated, handler)
    return () => {
      ipcRenderer.removeListener(IpcEvent.portsUpdated, handler)
    }
  },
  onFocusSearch: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IpcEvent.focusSearch, handler)
    return () => {
      ipcRenderer.removeListener(IpcEvent.focusSearch, handler)
    }
  },
  onProfilesChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IpcEvent.profilesChanged, handler)
    return () => {
      ipcRenderer.removeListener(IpcEvent.profilesChanged, handler)
    }
  },
  onOpenProfileCreator: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(IpcEvent.openProfileCreator, handler)
    return () => {
      ipcRenderer.removeListener(IpcEvent.openProfileCreator, handler)
    }
  },
  onNavigateTo: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, nav: NavLocation) =>
      callback(nav)
    ipcRenderer.on(IpcEvent.navigateTo, handler)
    return () => {
      ipcRenderer.removeListener(IpcEvent.navigateTo, handler)
    }
  },
  onUpdateStatus: (callback: (info: UpdateInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info)
    ipcRenderer.on(IpcEvent.updateStatus, handler)
    return () => {
      ipcRenderer.removeListener(IpcEvent.updateStatus, handler)
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
    ipcRenderer.on(IpcEvent.appToast, handler)
    return () => {
      ipcRenderer.removeListener(IpcEvent.appToast, handler)
    }
  },

  clipboardGetHistory: () => ipcRenderer.invoke(IpcChannel.clipboardGetHistory),
  clipboardSetCapture: (enabled) =>
    ipcRenderer.invoke(IpcChannel.clipboardSetCapture, enabled),
  clipboardIsCaptureEnabled: () =>
    ipcRenderer.invoke(IpcChannel.clipboardIsCaptureEnabled),
  clipboardPin: (id, pinned) => ipcRenderer.invoke(IpcChannel.clipboardPin, id, pinned),
  clipboardDelete: (id) => ipcRenderer.invoke(IpcChannel.clipboardDelete, id),
  clipboardClear: (keepPinned) =>
    ipcRenderer.invoke(IpcChannel.clipboardClear, keepPinned),
  clipboardWrite: (text) => ipcRenderer.invoke(IpcChannel.clipboardWrite, text),
  onClipboardUpdate: (callback) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      items: ClipboardItem[]
    ) => callback(items)
    ipcRenderer.on(IpcEvent.clipboardUpdated, handler)
    return () => ipcRenderer.removeListener(IpcEvent.clipboardUpdated, handler)
  },

  dbListConnections: () => ipcRenderer.invoke(IpcChannel.dbListConnections),
  dbListLive: () => ipcRenderer.invoke(IpcChannel.dbListLive),
  dbSaveConnection: (profile) =>
    ipcRenderer.invoke(IpcChannel.dbSaveConnection, profile),
  dbDeleteConnection: (id) => ipcRenderer.invoke(IpcChannel.dbDeleteConnection, id),
  dbConnect: (id) => ipcRenderer.invoke(IpcChannel.dbConnect, id),
  dbDisconnect: (id) => ipcRenderer.invoke(IpcChannel.dbDisconnect, id),
  dbQuery: (id, sql, opts) => ipcRenderer.invoke(IpcChannel.dbQuery, id, sql, opts),
  dbTables: (id) => ipcRenderer.invoke(IpcChannel.dbTables, id),
  dbTableSchema: (id, table) =>
    ipcRenderer.invoke(IpcChannel.dbTableSchema, id, table),
  dbBrowseTable: (id, table, opts) =>
    ipcRenderer.invoke(IpcChannel.dbBrowseTable, id, table, opts),
  dbAnalyzeSql: (sql) => ipcRenderer.invoke(IpcChannel.dbAnalyzeSql, sql),
  dbExplain: (id, sql, analyze) =>
    ipcRenderer.invoke(IpcChannel.dbExplain, id, sql, analyze),
  dbSavedQueries: (connectionId) =>
    ipcRenderer.invoke(IpcChannel.dbSavedQueries, connectionId),
  dbSaveQuery: (input) => ipcRenderer.invoke(IpcChannel.dbSaveQuery, input),
  dbDeleteSavedQuery: (id) => ipcRenderer.invoke(IpcChannel.dbDeleteSavedQuery, id),
  dbTableDdl: (id, table) => ipcRenderer.invoke(IpcChannel.dbTableDdl, id, table),
  dbUpdateCell: (id, input) => ipcRenderer.invoke(IpcChannel.dbUpdateCell, id, input),
  dbInsertRow: (id, input) => ipcRenderer.invoke(IpcChannel.dbInsertRow, id, input),
  dbImportCsv: (id, input) => ipcRenderer.invoke(IpcChannel.dbImportCsv, id, input),
  dbRedisKeys: (id, opts) => ipcRenderer.invoke(IpcChannel.dbRedisKeys, id, opts),
  dbRedisKey: (id, key) => ipcRenderer.invoke(IpcChannel.dbRedisKey, id, key),
  dbHistory: (connectionId) => ipcRenderer.invoke(IpcChannel.dbHistory, connectionId),
  dbPickSqliteFile: () => ipcRenderer.invoke(IpcChannel.dbPickSqliteFile),
  dbPickSshKey: () => ipcRenderer.invoke(IpcChannel.dbPickSshKey),
  dbGetAccessInfo: (id) => ipcRenderer.invoke(IpcChannel.dbAccessInfo, id),

  windowIsFullScreen: () => ipcRenderer.invoke(IpcChannel.windowIsFullScreen),
  windowSetFullScreen: (flag) =>
    ipcRenderer.invoke(IpcChannel.windowSetFullScreen, flag),
  windowToggleFullScreen: () => ipcRenderer.invoke(IpcChannel.windowToggleFullScreen),
  onWindowFullScreenChange: (callback) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      isFullScreen: boolean
    ) => callback(isFullScreen)
    ipcRenderer.on(IpcEvent.windowFullScreenChanged, handler)
    return () =>
      ipcRenderer.removeListener(IpcEvent.windowFullScreenChanged, handler)
  },

  textSnapshotsList: (tool) => ipcRenderer.invoke(IpcChannel.textSnapshotsList, tool),
  textSnapshotsSave: (input) => ipcRenderer.invoke(IpcChannel.textSnapshotsSave, input),
  textSnapshotsUpdateLabel: (id, label) =>
    ipcRenderer.invoke(IpcChannel.textSnapshotsUpdateLabel, id, label),
  textSnapshotsDelete: (id) => ipcRenderer.invoke(IpcChannel.textSnapshotsDelete, id),
  onTextSnapshotsUpdate: (callback) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      items: TextSnapshot[]
    ) => callback(items)
    ipcRenderer.on(IpcEvent.textSnapshotsUpdated, handler)
    return () => ipcRenderer.removeListener(IpcEvent.textSnapshotsUpdated, handler)
  },

  saveTextFile: (payload) => ipcRenderer.invoke(IpcChannel.saveTextFile, payload),
  saveHtmlAsPdf: (payload) => ipcRenderer.invoke(IpcChannel.saveHtmlAsPdf, payload)
}

contextBridge.exposeInMainWorld('api', api)
