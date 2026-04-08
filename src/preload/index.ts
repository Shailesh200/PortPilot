import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi, PortInfo, ProfilesPersistState } from '../shared/types'

const api: IpcApi = {
  getPorts: () => ipcRenderer.invoke('get-ports'),
  getProcessDetails: (pid: number) => ipcRenderer.invoke('get-process-details', pid),
  getProcessLogs: (pid: number) => ipcRenderer.invoke('get-process-logs', pid),
  killProcess: (pid: number, force?: boolean) => ipcRenderer.invoke('kill-process', pid, force),
  killProcesses: (pids: number[]) => ipcRenderer.invoke('kill-processes', pids),
  openInBrowser: (port: number) => ipcRenderer.invoke('open-in-browser', port),
  openInTerminal: (pid: number, projectPath?: string) => ipcRenderer.invoke('open-in-terminal', pid, projectPath),
  openInVSCode: (pid: number, projectPath?: string) => ipcRenderer.invoke('open-in-vscode', pid, projectPath),
  restartProcess: (pid: number, projectPath?: string) =>
    ipcRenderer.invoke('restart-process', pid, projectPath),
  updatePollInterval: (intervalMs: number) => ipcRenderer.invoke('update-poll-interval', intervalMs),
  updateGlobalShortcut: (shortcut: string) => ipcRenderer.invoke('update-global-shortcut', shortcut),
  loadProfiles: () => ipcRenderer.invoke('load-profiles'),
  saveProfiles: (state: ProfilesPersistState) =>
    ipcRenderer.invoke('save-profiles', state),
  onPortsUpdate: (callback: (ports: PortInfo[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ports: PortInfo[]) => callback(ports)
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
  }
}

contextBridge.exposeInMainWorld('api', api)
