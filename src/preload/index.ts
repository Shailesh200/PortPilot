import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcApi,
  PortInfo,
  ProfilesPersistState,
  UpdateInfo,
  ClipboardItem
} from '../shared/types'

const api: IpcApi = {
  getPorts: () => ipcRenderer.invoke('get-ports'),
  getProcessDetails: (pid: number) => ipcRenderer.invoke('get-process-details', pid),
  getProcessLogs: (pid: number) => ipcRenderer.invoke('get-process-logs', pid),
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
  onUpdateStatus: (callback: (info: UpdateInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info)
    ipcRenderer.on('update-status', handler)
    return () => {
      ipcRenderer.removeListener('update-status', handler)
    }
  },

  clipboardGetHistory: () => ipcRenderer.invoke('clipboard-get-history'),
  clipboardSetCapture: (enabled) =>
    ipcRenderer.invoke('clipboard-set-capture', enabled),
  clipboardIsCaptureEnabled: () =>
    ipcRenderer.invoke('clipboard-is-capture-enabled'),
  clipboardPin: (id, pinned) => ipcRenderer.invoke('clipboard-pin', id, pinned),
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

  gitAvailable: () => ipcRenderer.invoke('git-available'),
  gitPickRepo: () => ipcRenderer.invoke('git-pick-repo'),
  gitResolveRoot: (cwd) => ipcRenderer.invoke('git-resolve-root', cwd),
  gitStatus: (cwd) => ipcRenderer.invoke('git-status', cwd),
  gitDiff: (cwd, file, staged) =>
    ipcRenderer.invoke('git-diff', cwd, file, staged),
  gitStage: (cwd, files) => ipcRenderer.invoke('git-stage', cwd, files),
  gitUnstage: (cwd, files) => ipcRenderer.invoke('git-unstage', cwd, files),
  gitCommit: (cwd, message) => ipcRenderer.invoke('git-commit', cwd, message),
  gitBranches: (cwd) => ipcRenderer.invoke('git-branches', cwd),
  gitCheckout: (cwd, branch) => ipcRenderer.invoke('git-checkout', cwd, branch),
  gitLog: (cwd) => ipcRenderer.invoke('git-log', cwd),
  gitShow: (cwd, hash) => ipcRenderer.invoke('git-show', cwd, hash),
  gitStashList: (cwd) => ipcRenderer.invoke('git-stash-list', cwd),
  gitStashApply: (cwd, index) =>
    ipcRenderer.invoke('git-stash-apply', cwd, index),
  gitStashPop: (cwd, index) => ipcRenderer.invoke('git-stash-pop', cwd, index),
  gitStashDrop: (cwd, index) =>
    ipcRenderer.invoke('git-stash-drop', cwd, index),
  gitBlame: (cwd, file) => ipcRenderer.invoke('git-blame', cwd, file),

  dbListConnections: () => ipcRenderer.invoke('db-list-connections'),
  dbSaveConnection: (profile) =>
    ipcRenderer.invoke('db-save-connection', profile),
  dbDeleteConnection: (id) => ipcRenderer.invoke('db-delete-connection', id),
  dbConnect: (id) => ipcRenderer.invoke('db-connect', id),
  dbDisconnect: (id) => ipcRenderer.invoke('db-disconnect', id),
  dbQuery: (id, sql) => ipcRenderer.invoke('db-query', id, sql),
  dbTables: (id) => ipcRenderer.invoke('db-tables', id),
  dbHistory: (connectionId) => ipcRenderer.invoke('db-history', connectionId),
  dbPickSqliteFile: () => ipcRenderer.invoke('db-pick-sqlite-file')
}

contextBridge.exposeInMainWorld('api', api)
