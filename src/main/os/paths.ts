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
