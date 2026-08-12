import { contextBridge } from 'electron'
import type { IpcApi } from '../shared/types'
import { IpcChannel, IpcEvent } from '../shared/ipc'
import { invoke, onEvent } from './ipc-bridge'

const api: IpcApi = {
  getPorts: () => invoke(IpcChannel.getPorts),
  getProcessDetails: (pid) => invoke(IpcChannel.getProcessDetails, pid),
  killProcess: (pid, force) => invoke(IpcChannel.killProcess, pid, force),
  killProcesses: (pids) => invoke(IpcChannel.killProcesses, pids),
  openInBrowser: (port) => invoke(IpcChannel.openInBrowser, port),
  openInTerminal: (pid, projectPath) =>
    invoke(IpcChannel.openInTerminal, pid, projectPath),
  openInVSCode: (pid, projectPath) =>
    invoke(IpcChannel.openInVscode, pid, projectPath),
  restartProcess: (pid, projectPath) =>
    invoke(IpcChannel.restartProcess, pid, projectPath),
  updatePollInterval: (intervalMs) =>
    invoke(IpcChannel.updatePollInterval, intervalMs),
  updateGlobalShortcut: (shortcut) =>
    invoke(IpcChannel.updateGlobalShortcut, shortcut),
  updateSafetySettings: (settings) =>
    invoke(IpcChannel.updateSafetySettings, settings),
  updateAlertSettings: (settings) =>
    invoke(IpcChannel.updateAlertSettings, settings),
  loadProfiles: () => invoke(IpcChannel.loadProfiles),
  saveProfiles: (state) => invoke(IpcChannel.saveProfiles, state),
  getAppVersion: () => invoke(IpcChannel.getAppVersion),
  quitAndInstall: () => invoke(IpcChannel.quitAndInstall),

  onPortsUpdate: (callback) => onEvent(IpcEvent.portsUpdated, callback),
  onFocusSearch: (callback) =>
    onEvent(IpcEvent.focusSearch, () => {
      callback()
    }),
  onProfilesChanged: (callback) =>
    onEvent(IpcEvent.profilesChanged, () => {
      callback()
    }),
  onOpenProfileCreator: (callback) =>
    onEvent(IpcEvent.openProfileCreator, () => {
      callback()
    }),
  onNavigateTo: (callback) => onEvent(IpcEvent.navigateTo, callback),
  onUpdateStatus: (callback) => onEvent(IpcEvent.updateStatus, callback),
  onAppToast: (callback) => onEvent(IpcEvent.appToast, callback),

  clipboardGetHistory: () => invoke(IpcChannel.clipboardGetHistory),
  clipboardSetCapture: (enabled) =>
    invoke(IpcChannel.clipboardSetCapture, enabled),
  clipboardIsCaptureEnabled: () => invoke(IpcChannel.clipboardIsCaptureEnabled),
  clipboardPin: (id, pinned) => invoke(IpcChannel.clipboardPin, id, pinned),
  clipboardDelete: (id) => invoke(IpcChannel.clipboardDelete, id),
  clipboardClear: (keepPinned) => invoke(IpcChannel.clipboardClear, keepPinned),
  clipboardWrite: (text) => invoke(IpcChannel.clipboardWrite, text),
  onClipboardUpdate: (callback) => onEvent(IpcEvent.clipboardUpdated, callback),

  dbListConnections: () => invoke(IpcChannel.dbListConnections),
  dbListLive: () => invoke(IpcChannel.dbListLive),
  dbSaveConnection: (profile) => invoke(IpcChannel.dbSaveConnection, profile),
  dbDeleteConnection: (id) => invoke(IpcChannel.dbDeleteConnection, id),
  dbConnect: (id) => invoke(IpcChannel.dbConnect, id),
  dbDisconnect: (id) => invoke(IpcChannel.dbDisconnect, id),
  dbQuery: (id, sql, opts) => invoke(IpcChannel.dbQuery, id, sql, opts),
  dbTables: (id) => invoke(IpcChannel.dbTables, id),
  dbTableSchema: (id, table) => invoke(IpcChannel.dbTableSchema, id, table),
  dbBrowseTable: (id, table, opts) =>
    invoke(IpcChannel.dbBrowseTable, id, table, opts),
  dbAnalyzeSql: (sql) => invoke(IpcChannel.dbAnalyzeSql, sql),
  dbExplain: (id, sql, analyze) =>
    invoke(IpcChannel.dbExplain, id, sql, analyze),
  dbSavedQueries: (connectionId) =>
    invoke(IpcChannel.dbSavedQueries, connectionId),
  dbSaveQuery: (input) => invoke(IpcChannel.dbSaveQuery, input),
  dbDeleteSavedQuery: (id) => invoke(IpcChannel.dbDeleteSavedQuery, id),
  dbTableDdl: (id, table) => invoke(IpcChannel.dbTableDdl, id, table),
  dbUpdateCell: (id, input) => invoke(IpcChannel.dbUpdateCell, id, input),
  dbInsertRow: (id, input) => invoke(IpcChannel.dbInsertRow, id, input),
  dbImportCsv: (id, input) => invoke(IpcChannel.dbImportCsv, id, input),
  dbRedisKeys: (id, opts) => invoke(IpcChannel.dbRedisKeys, id, opts),
  dbRedisKey: (id, key) => invoke(IpcChannel.dbRedisKey, id, key),
  dbHistory: (connectionId) => invoke(IpcChannel.dbHistory, connectionId),
  dbPickSqliteFile: () => invoke(IpcChannel.dbPickSqliteFile),
  dbPickSshKey: () => invoke(IpcChannel.dbPickSshKey),
  dbGetAccessInfo: (id) => invoke(IpcChannel.dbAccessInfo, id),

  windowIsFullScreen: () => invoke(IpcChannel.windowIsFullScreen),
  windowSetFullScreen: (flag) => invoke(IpcChannel.windowSetFullScreen, flag),
  windowToggleFullScreen: () => invoke(IpcChannel.windowToggleFullScreen),
  onWindowFullScreenChange: (callback) =>
    onEvent(IpcEvent.windowFullScreenChanged, callback),

  textSnapshotsList: (tool) => invoke(IpcChannel.textSnapshotsList, tool),
  textSnapshotsSave: (input) => invoke(IpcChannel.textSnapshotsSave, input),
  textSnapshotsUpdateLabel: (id, label) =>
    invoke(IpcChannel.textSnapshotsUpdateLabel, id, label),
  textSnapshotsDelete: (id) => invoke(IpcChannel.textSnapshotsDelete, id),
  onTextSnapshotsUpdate: (callback) =>
    onEvent(IpcEvent.textSnapshotsUpdated, callback),

  saveTextFile: (payload) => invoke(IpcChannel.saveTextFile, payload),
  saveHtmlAsPdf: (payload) => invoke(IpcChannel.saveHtmlAsPdf, payload)
}

contextBridge.exposeInMainWorld('api', api)
