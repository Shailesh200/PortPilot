/**
 * OS / platform service façade.
 * Prefer this module over direct Electron APIs in feature code so
 * platform concerns stay in one place.
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
  resolveAppIconPath,
  loadTrayNativeImage,
  loadAppNativeImage
} from './resources'
export {
  getUserDataPath,
  userDataFile,
  getAppVersion,
  isAppPackaged,
  getAppPath,
  getMacKeychainTrustPath
} from './paths'
export {
  isSecureStorageAvailable,
  encryptSecret,
  decryptSecret,
  storedSecretUnreadable
} from './secure-store'
export {
  saveSecret,
  loadSecret,
  deleteSecrets,
  deleteAllSecrets,
  secretIndexHas,
  clearSessionSecrets,
  rememberSecret,
  forgetPersistedSecret
} from './secrets-vault'
export { eraseAllAppDataAndQuit } from './app-data'
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
