import { app, session } from 'electron'
import { spawn } from 'child_process'
import { deleteAllSecrets } from './secrets-vault'
import { getUserDataPath } from './paths'

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function cmdQuote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

/**
 * Wipe local PortPilot data (userData, logs, connection secrets / Keychain)
 * then quit. Chromium files may be locked until exit, so deletion is
 * scheduled 1s after quit via a detached shell.
 *
 * Dragging PortPilot.app to Trash on macOS does not run this — use Settings
 * or resources/uninstall-macos.sh. Windows NSIS uninstall also deletes app data.
 */
export function eraseAllAppDataAndQuit(): void {
  deleteAllSecrets()
  void session.defaultSession.clearCache()
  void session.defaultSession.clearStorageData()

  const userData = getUserDataPath()
  const logs = app.getPath('logs')
  let crashDumps = ''
  try {
    crashDumps = app.getPath('crashDumps')
  } catch {
    /* unavailable on some platforms */
  }

  if (process.platform === 'win32') {
    const parts = [`rmdir /s /q ${cmdQuote(userData)}`, `rmdir /s /q ${cmdQuote(logs)}`]
    if (crashDumps) parts.push(`rmdir /s /q ${cmdQuote(crashDumps)}`)
    spawn(
      'cmd.exe',
      ['/c', `ping 127.0.0.1 -n 2 > nul & ${parts.join(' & ')}`],
      { detached: true, stdio: 'ignore', windowsHide: true }
    ).unref()
  } else {
    const paths = [userData, logs, crashDumps].filter(Boolean).map(shQuote)
    spawn('/bin/bash', ['-c', `sleep 1; rm -rf ${paths.join(' ')}`], {
      detached: true,
      stdio: 'ignore'
    }).unref()
  }

  app.quit()
}
