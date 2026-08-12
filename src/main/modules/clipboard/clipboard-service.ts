import { clipboard, BrowserWindow, app } from 'electron'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync
} from 'fs'
import { join } from 'path'
import type { ClipboardItem, ClipboardKind } from '../../../shared/types'

const MAX_ITEMS = 200
let history: ClipboardItem[] = []
let historyLoaded = false
let lastText = ''
let timer: ReturnType<typeof setInterval> | null = null
let captureEnabled = false

function filePath(): string {
  return join(app.getPath('userData'), 'clipboard-history.json')
}

function classify(text: string): ClipboardKind {
  const t = text.trim()
  if (/^https?:\/\/\S+$/i.test(t)) return 'url'
  if (/^#[0-9a-f]{3,8}$/i.test(t) || /^rgba?\([^)]+\)$/i.test(t)) return 'color'
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) return 'jwt'
  if (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  ) {
    try {
      JSON.parse(t)
      return 'json'
    } catch {
      /* ignore invalid JSON */
    }
  }
  if (/^(import |export |const |function |class |def )/m.test(t)) return 'code'
  return 'text'
}

function persist(): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const target = filePath()
    const tmp = `${target}.tmp`
    writeFileSync(tmp, JSON.stringify({ items: history }, null, 2), 'utf-8')
    renameSync(tmp, target)
  } catch {
    /* ignore */
  }
}

function broadcast(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('clipboard-updated', history)
  }
}

export function loadClipboardHistory(): ClipboardItem[] {
  if (historyLoaded) return history
  historyLoaded = true
  try {
    const p = filePath()
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf-8')) as {
        items?: ClipboardItem[]
      }
      if (Array.isArray(raw.items)) history = raw.items.slice(0, MAX_ITEMS)
    }
  } catch {
    history = []
  }
  return history
}

export function getClipboardHistory(): ClipboardItem[] {
  return history
}

export function setClipboardCapture(enabled: boolean): void {
  captureEnabled = enabled
  if (enabled) startClipboardWatch()
  else stopClipboardWatch()
}

export function isClipboardCaptureEnabled(): boolean {
  return captureEnabled
}

export function pinClipboardItem(id: string, pinned: boolean): ClipboardItem[] {
  history = history.map((h) => (h.id === id ? { ...h, pinned } : h))
  persist()
  broadcast()
  return history
}

export function deleteClipboardItem(id: string): ClipboardItem[] {
  history = history.filter((h) => h.id !== id)
  persist()
  broadcast()
  return history
}

export function clearClipboardHistory(keepPinned: boolean): ClipboardItem[] {
  history = keepPinned ? history.filter((h) => h.pinned) : []
  persist()
  broadcast()
  return history
}

export function writeClipboardText(text: string): void {
  clipboard.writeText(text)
  lastText = text
}

function poll(): void {
  if (!captureEnabled) return
  try {
    const text = clipboard.readText()
    if (!text || text === lastText) return
    lastText = text
    if (text.length > 100_000) return
    const item: ClipboardItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      kind: classify(text),
      createdAt: Date.now(),
      pinned: false
    }
    history = [item, ...history.filter((h) => h.text !== text)].slice(
      0,
      MAX_ITEMS
    )
    history.sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt
    )
    persist()
    broadcast()
  } catch {
    /* ignore */
  }
}

export function startClipboardWatch(): void {
  if (timer) return
  lastText = clipboard.readText()
  timer = setInterval(poll, 800)
}

export function stopClipboardWatch(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
