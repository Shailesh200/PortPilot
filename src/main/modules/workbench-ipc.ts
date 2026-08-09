import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  loadClipboardHistory,
  getClipboardHistory,
  setClipboardCapture,
  isClipboardCaptureEnabled,
  pinClipboardItem,
  clearClipboardHistory,
  writeClipboardText,
  startClipboardWatch,
  stopClipboardWatch
} from './clipboard/clipboard-service'
import * as git from './git/git-service'
import * as db from './database/db-service'

export function registerWorkbenchIpc(): void {
  loadClipboardHistory()
  db.loadDbStore()

  // —— Clipboard ——
  ipcMain.handle('clipboard-get-history', () => getClipboardHistory())
  ipcMain.handle('clipboard-set-capture', (_e, enabled: boolean) => {
    setClipboardCapture(Boolean(enabled))
    return isClipboardCaptureEnabled()
  })
  ipcMain.handle('clipboard-is-capture-enabled', () => isClipboardCaptureEnabled())
  ipcMain.handle('clipboard-pin', (_e, id: string, pinned: boolean) =>
    pinClipboardItem(String(id), Boolean(pinned))
  )
  ipcMain.handle('clipboard-clear', (_e, keepPinned: boolean) =>
    clearClipboardHistory(Boolean(keepPinned))
  )
  ipcMain.handle('clipboard-write', (_e, text: string) => {
    writeClipboardText(String(text ?? ''))
  })

  // —— Git ——
  ipcMain.handle('git-available', () => git.gitIsAvailable())
  ipcMain.handle('git-pick-repo', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    if (r.canceled || !r.filePaths[0]) return null
    const root = await git.gitRevParse(r.filePaths[0])
    return root
  })
  ipcMain.handle('git-status', (_e, cwd: string) => git.gitStatus(String(cwd)))
  ipcMain.handle('git-diff', (_e, cwd: string, file?: string, staged?: boolean) =>
    git.gitDiff(String(cwd), file ? String(file) : undefined, Boolean(staged))
  )
  ipcMain.handle('git-stage', (_e, cwd: string, files: string[]) =>
    git.gitStage(String(cwd), files.map(String))
  )
  ipcMain.handle('git-unstage', (_e, cwd: string, files: string[]) =>
    git.gitUnstage(String(cwd), files.map(String))
  )
  ipcMain.handle('git-commit', (_e, cwd: string, message: string) =>
    git.gitCommit(String(cwd), String(message))
  )
  ipcMain.handle('git-branches', (_e, cwd: string) => git.gitBranches(String(cwd)))
  ipcMain.handle('git-checkout', (_e, cwd: string, branch: string) =>
    git.gitCheckout(String(cwd), String(branch))
  )
  ipcMain.handle('git-log', (_e, cwd: string) => git.gitLog(String(cwd)))
  ipcMain.handle('git-show', (_e, cwd: string, hash: string) =>
    git.gitShow(String(cwd), String(hash))
  )
  ipcMain.handle('git-stash-list', (_e, cwd: string) => git.gitStashList(String(cwd)))
  ipcMain.handle('git-stash-apply', (_e, cwd: string, index: number) =>
    git.gitStashApply(String(cwd), Number(index))
  )
  ipcMain.handle('git-stash-pop', (_e, cwd: string, index: number) =>
    git.gitStashPop(String(cwd), Number(index))
  )
  ipcMain.handle('git-stash-drop', (_e, cwd: string, index: number) =>
    git.gitStashDrop(String(cwd), Number(index))
  )
  ipcMain.handle('git-blame', (_e, cwd: string, file: string) =>
    git.gitBlame(String(cwd), String(file))
  )
  ipcMain.handle('git-resolve-root', (_e, cwd: string) =>
    git.gitRevParse(String(cwd))
  )

  // —— Database ——
  ipcMain.handle('db-list-connections', () => db.listConnections())
  ipcMain.handle('db-save-connection', (_e, profile: unknown) => {
    db.saveConnection(profile as Parameters<typeof db.saveConnection>[0])
    return db.listConnections()
  })
  ipcMain.handle('db-delete-connection', (_e, id: string) => {
    db.deleteConnection(String(id))
    return db.listConnections()
  })
  ipcMain.handle('db-connect', (_e, id: string) => db.connect(String(id)))
  ipcMain.handle('db-disconnect', (_e, id: string) => db.disconnect(String(id)))
  ipcMain.handle('db-query', (_e, id: string, sql: string) =>
    db.runQuery(String(id), String(sql))
  )
  ipcMain.handle('db-tables', (_e, id: string) => db.listTables(String(id)))
  ipcMain.handle('db-history', (_e, id?: string) =>
    db.getQueryHistory(id ? String(id) : undefined)
  )
  ipcMain.handle('db-pick-sqlite-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'promptToCreate'],
      filters: [{ name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    return r.filePaths[0]
  })
}

export function shutdownWorkbench(): void {
  stopClipboardWatch()
}
