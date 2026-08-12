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
export {
  resolveResourcePath,
  resolveTrayIconPath,
  loadTrayNativeImage
} from './resources'
export {
  getUserDataPath,
  userDataFile,
  getAppVersion,
  isAppPackaged,
  getAppPath
} from './paths'
export {
  isSecureStorageAvailable,
  encryptSecret,
  decryptSecret
} from './secure-store'
export { readClipboardText, writeClipboardText } from './clipboard'
export { openExternal } from './shell'
export {
  showOpenDialog,
  showSaveDialog,
  showMessageBox,
  type FileFilter,
  type OpenDialogOptions,
  type SaveDialogOptions,
  type MessageBoxOptions
} from './dialogs'
export {
  setNotificationClickHandler,
  showNativeNotification
} from './notifications'
