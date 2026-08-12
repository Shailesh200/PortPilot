/**
 * OS / platform service façade.
 * Electron main code should depend on this module so a future shell
 * (Tauri, etc.) can swap implementations without rewriting IPC/UI.
 */
export { scanPorts } from '../services/port-scanner'
export {
  getProcessDetails,
  killProcess,
  killProcesses,
  openInBrowser,
  openInTerminal,
  openInVSCode,
  restartProcess,
  setAutoFocusTerminal
} from '../services/process-manager'
export { resolveResourcePath, resolveTrayIconPath } from './resources'
