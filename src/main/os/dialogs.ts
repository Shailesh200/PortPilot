import { BrowserWindow, dialog } from 'electron'

export type FileFilter = { name: string; extensions: string[] }

export type OpenDialogOptions = {
  title?: string
  defaultPath?: string
  filters?: FileFilter[]
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  >
}

export type SaveDialogOptions = {
  title?: string
  defaultPath?: string
  filters?: FileFilter[]
}

export type MessageBoxOptions = {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning'
  buttons?: string[]
  defaultId?: number
  cancelId?: number
  title?: string
  message: string
  detail?: string
}

function focusedWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? undefined
}

export async function showOpenDialog(
  options: OpenDialogOptions
): Promise<{ canceled: boolean; filePaths: string[] }> {
  const win = focusedWindow()
  return win
    ? dialog.showOpenDialog(win, options)
    : dialog.showOpenDialog(options)
}

export async function showSaveDialog(
  options: SaveDialogOptions
): Promise<{ canceled: boolean; filePath?: string }> {
  const win = focusedWindow()
  return win
    ? dialog.showSaveDialog(win, options)
    : dialog.showSaveDialog(options)
}

export async function showMessageBox(
  options: MessageBoxOptions
): Promise<{ response: number }> {
  const win = focusedWindow()
  return win
    ? dialog.showMessageBox(win, options)
    : dialog.showMessageBox(options)
}
