import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import { basename, extname } from 'path'
import {
  loadClipboardHistory,
  getClipboardHistory,
  setClipboardCapture,
  isClipboardCaptureEnabled,
  pinClipboardItem,
  deleteClipboardItem,
  clearClipboardHistory,
  writeClipboardText,
  stopClipboardWatch
} from './clipboard/clipboard-service'
import * as db from './database/db-service'
import {
  loadTextSnapshots,
  listTextSnapshots,
  saveTextSnapshot,
  updateTextSnapshotLabel,
  deleteTextSnapshot
} from './text/text-snapshots-service'
import type {
  JsonDiffSnapshotInput,
  JsonFormatterSnapshotInput,
  TextDiffSnapshotInput,
  TextSnapshotTool
} from '../../shared/types'
import { IpcChannel, IpcEvent } from '../../shared/ipc'

export function registerWorkbenchIpc(): void {
  // Defer disk reads so cold start isn't blocked on workbench JSON.
  const hydrate = (): void => {
    try {
      loadClipboardHistory()
      db.loadDbStore()
      loadTextSnapshots()
    } catch {
      /* best-effort */
    }
  }
  setTimeout(hydrate, 0)

  // —— Clipboard ——
  ipcMain.handle(IpcChannel.clipboardGetHistory, () => {
    loadClipboardHistory()
    return getClipboardHistory()
  })
  ipcMain.handle(IpcChannel.clipboardSetCapture, (_e, enabled: boolean) => {
    setClipboardCapture(Boolean(enabled))
    return isClipboardCaptureEnabled()
  })
  ipcMain.handle(IpcChannel.clipboardIsCaptureEnabled, () => isClipboardCaptureEnabled())
  ipcMain.handle(IpcChannel.clipboardPin, (_e, id: string, pinned: boolean) =>
    pinClipboardItem(String(id), Boolean(pinned))
  )
  ipcMain.handle(IpcChannel.clipboardDelete, (_e, id: string) =>
    deleteClipboardItem(String(id))
  )
  ipcMain.handle(IpcChannel.clipboardClear, (_e, keepPinned: boolean) =>
    clearClipboardHistory(Boolean(keepPinned))
  )
  ipcMain.handle(IpcChannel.clipboardWrite, (_e, text: string) => {
    writeClipboardText(String(text ?? ''))
  })

  // —— Database ——
  ipcMain.handle(IpcChannel.dbListConnections, () => {
    db.loadDbStore()
    return db.listConnections()
  })
  ipcMain.handle(IpcChannel.dbListLive, () => db.listLiveConnectionIds())
  ipcMain.handle(IpcChannel.dbSaveConnection, (_e, profile: unknown) => {
    db.saveConnection(profile as Parameters<typeof db.saveConnection>[0])
    return db.listConnections()
  })
  ipcMain.handle(IpcChannel.dbDeleteConnection, (_e, id: string) => {
    db.deleteConnection(String(id))
    return db.listConnections()
  })
  ipcMain.handle(IpcChannel.dbConnect, (_e, id: string) => db.connect(String(id)))
  ipcMain.handle(IpcChannel.dbDisconnect, (_e, id: string) => db.disconnect(String(id)))
  ipcMain.handle(
    IpcChannel.dbQuery,
    (_e, id: string, sql: string, opts?: { allowDestructive?: boolean }) =>
      db.runQuery(String(id), String(sql), opts)
  )
  ipcMain.handle(IpcChannel.dbTables, (_e, id: string) => db.listTables(String(id)))
  ipcMain.handle(IpcChannel.dbTableSchema, (_e, id: string, table: string) =>
    db.getTableSchema(String(id), String(table))
  )
  ipcMain.handle(
    IpcChannel.dbBrowseTable,
    (
      _e,
      id: string,
      table: string,
      opts: { where?: string; limit?: number; offset?: number }
    ) => db.browseTable(String(id), String(table), opts || {})
  )
  ipcMain.handle(IpcChannel.dbAnalyzeSql, (_e, sql: string) =>
    db.analyzeSql(String(sql))
  )
  ipcMain.handle(
    IpcChannel.dbExplain,
    (_e, id: string, sql: string, analyze?: boolean) =>
      db.explainQuery(String(id), String(sql), !!analyze)
  )
  ipcMain.handle(IpcChannel.dbSavedQueries, (_e, id?: string) =>
    db.listSavedQueries(id ? String(id) : undefined)
  )
  ipcMain.handle(IpcChannel.dbSaveQuery, (_e, input: unknown) =>
    db.saveSavedQuery(input as Parameters<typeof db.saveSavedQuery>[0])
  )
  ipcMain.handle(IpcChannel.dbDeleteSavedQuery, (_e, id: string) =>
    db.deleteSavedQuery(String(id))
  )
  ipcMain.handle(IpcChannel.dbTableDdl, (_e, id: string, table: string) =>
    db.getTableDdl(String(id), String(table))
  )
  ipcMain.handle(
    IpcChannel.dbUpdateCell,
    (
      _e,
      id: string,
      input: {
        table: string
        pkColumn: string
        pkValue: unknown
        column: string
        value: unknown
      }
    ) => db.updateTableCell(String(id), input)
  )
  ipcMain.handle(
    IpcChannel.dbInsertRow,
    (
      _e,
      id: string,
      input: { table: string; columns: string[]; values: unknown[] }
    ) => db.insertTableRow(String(id), input)
  )
  ipcMain.handle(
    IpcChannel.dbImportCsv,
    (
      _e,
      id: string,
      input: {
        table: string
        columns: string[]
        rows: unknown[][]
        batchSize?: number
      }
    ) => db.importCsv(String(id), input)
  )
  ipcMain.handle(
    IpcChannel.dbRedisKeys,
    (_e, id: string, opts?: { pattern?: string; count?: number }) =>
      db.browseRedisKeys(String(id), opts || {})
  )
  ipcMain.handle(IpcChannel.dbRedisKey, (_e, id: string, key: string) =>
    db.getRedisKey(String(id), String(key))
  )
  ipcMain.handle(IpcChannel.dbHistory, (_e, id?: string) =>
    db.getQueryHistory(id ? String(id) : undefined)
  )
  ipcMain.handle(IpcChannel.dbAccessInfo, (_e, id: string) =>
    db.getAccessInfo(String(id))
  )
  ipcMain.handle(IpcChannel.dbPickSqliteFile, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'promptToCreate'],
      filters: [{ name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    return r.filePaths[0]
  })
  ipcMain.handle(IpcChannel.dbPickSshKey, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      defaultPath: `${process.env.HOME || ''}/.ssh`
    })
    if (r.canceled || !r.filePaths[0]) return null
    return r.filePaths[0]
  })

  // —— Text tool snapshots ——
  ipcMain.handle(IpcChannel.textSnapshotsList, (_e, tool?: TextSnapshotTool) => {
    loadTextSnapshots()
    return listTextSnapshots(tool)
  })
  ipcMain.handle(
    IpcChannel.textSnapshotsSave,
    (
      _e,
      input:
        | JsonDiffSnapshotInput
        | JsonFormatterSnapshotInput
        | TextDiffSnapshotInput
    ) => saveTextSnapshot(input)
  )
  ipcMain.handle(
    IpcChannel.textSnapshotsUpdateLabel,
    (_e, id: string, label: string) =>
      updateTextSnapshotLabel(String(id), String(label ?? ''))
  )
  ipcMain.handle(IpcChannel.textSnapshotsDelete, (_e, id: string) =>
    deleteTextSnapshot(String(id))
  )

  // —— Save text file (Format Converter, etc.) ——
  ipcMain.handle(
    IpcChannel.saveTextFile,
    async (
      _e,
      payload: {
        content: string
        defaultName?: string
        encoding?: 'utf8' | 'base64'
        filters?: { name: string; extensions: string[] }[]
      }
    ) => {
      const win = BrowserWindow.getFocusedWindow()
      const defaultName =
        typeof payload?.defaultName === 'string' && payload.defaultName.trim()
          ? payload.defaultName.trim()
          : 'converted.txt'
      const filters =
        Array.isArray(payload?.filters) && payload.filters.length > 0
          ? payload.filters
          : [
              {
                name: 'Text',
                extensions: [extname(defaultName).replace(/^\./, '') || 'txt']
              },
              { name: 'All Files', extensions: ['*'] }
            ]

      const r = await dialog.showSaveDialog(win!, {
        defaultPath: defaultName,
        filters
      })
      if (r.canceled || !r.filePath) {
        return { ok: false as const, canceled: true as const }
      }

      try {
        const encoding = payload?.encoding === 'base64' ? 'base64' : 'utf8'
        const body =
          encoding === 'base64'
            ? Buffer.from(String(payload?.content ?? ''), 'base64')
            : String(payload?.content ?? '')
        writeFileSync(r.filePath, body)
        return {
          ok: true as const,
          path: r.filePath,
          name: basename(r.filePath)
        }
      } catch (e) {
        return {
          ok: false as const,
          canceled: false as const,
          error: e instanceof Error ? e.message : 'Could not write file'
        }
      }
    }
  )

  // —— HTML → PDF (Chromium printToPDF) ——
  async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
    const pdfWin = new BrowserWindow({
      show: false,
      width: 800,
      height: 1100,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    try {
      await pdfWin.loadURL('about:blank')
      await pdfWin.webContents.executeJavaScript(
        `document.open();document.write(${JSON.stringify(html)});document.close();`
      )
      // Let layout settle for tables/images
      await new Promise((resolve) => setTimeout(resolve, 200))
      return await pdfWin.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'default' }
      })
    } finally {
      if (!pdfWin.isDestroyed()) pdfWin.destroy()
    }
  }

  ipcMain.handle(
    IpcChannel.saveHtmlAsPdf,
    async (
      _e,
      payload: {
        html: string
        defaultName?: string
        preview?: boolean
      }
    ) => {
      const html = String(payload?.html ?? '')

      // Live preview: return PDF bytes, no save dialog
      if (payload?.preview) {
        try {
          const pdf = await renderHtmlToPdfBuffer(html)
          return {
            ok: true as const,
            preview: true as const,
            base64: pdf.toString('base64')
          }
        } catch (e) {
          return {
            ok: false as const,
            canceled: false as const,
            error: e instanceof Error ? e.message : 'Could not create PDF'
          }
        }
      }

      const parent = BrowserWindow.getFocusedWindow()
      const defaultName =
        typeof payload?.defaultName === 'string' && payload.defaultName.trim()
          ? payload.defaultName.trim()
          : 'converted.pdf'

      const r = await dialog.showSaveDialog(parent!, {
        defaultPath: defaultName,
        filters: [
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (r.canceled || !r.filePath) {
        return { ok: false as const, canceled: true as const }
      }

      try {
        const pdf = await renderHtmlToPdfBuffer(html)
        writeFileSync(r.filePath, pdf)
        return {
          ok: true as const,
          path: r.filePath,
          name: basename(r.filePath)
        }
      } catch (e) {
        return {
          ok: false as const,
          canceled: false as const,
          error: e instanceof Error ? e.message : 'Could not create PDF'
        }
      }
    }
  )
}

export async function shutdownWorkbench(): Promise<void> {
  stopClipboardWatch()
  await Promise.race([
    db.disconnectAll(),
    new Promise<void>((resolve) => setTimeout(resolve, 2500))
  ])
}
