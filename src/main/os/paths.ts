import { app } from 'electron'
import { join } from 'path'

/** App user-data directory (Electron `userData`). */
export function getUserDataPath(): string {
  return app.getPath('userData')
}

/** Join a path under userData. */
export function userDataFile(...segments: string[]): string {
  return join(getUserDataPath(), ...segments)
}

export function getAppVersion(): string {
  return app.getVersion()
}

export function isAppPackaged(): boolean {
  return app.isPackaged
}

export function getAppPath(): string {
  return app.getAppPath()
}

/** .app bundle (packaged) or the Electron helper (dev) for Keychain ACLs. */
export function getMacKeychainTrustPath(): string {
  if (!app.isPackaged) return process.execPath
  const exe = app.getPath('exe')
  const marker = '.app/'
  const idx = exe.indexOf(marker)
  return idx >= 0 ? exe.slice(0, idx + marker.length - 1) : exe
}
