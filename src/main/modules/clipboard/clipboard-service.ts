import { BrowserWindow } from 'electron'
import { sendEvent } from '../../ipc-handle'
import { IpcEvent } from '../../../shared/ipc'
import {
  userDataFile,
  readClipboardText,
  writeClipboardText as writeOsClipboard,
  writeJsonAtomicSilent
} from '../../os'
import { existsSync, readFileSync } from 'fs'
import type { ClipboardItem, ClipboardKind } from '../../../shared/types'
import { classifyClipboardKind } from '../../../shared/smart-paste'

const MAX_ITEMS = 200
let history: ClipboardItem[] = []
let historyLoaded = false
let lastText = ''
let timer: ReturnType<typeof setInterval> | null = null
let captureEnabled = false

function filePath(): string {
  return userDataFile('clipboard-history.json')
}

function classify(text: string): ClipboardKind {
  return classifyClipboardKind(text)
}

function persist(): void {
  writeJsonAtomicSilent(filePath(), { items: history })
}

function broadcast(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) sendEvent(w, IpcEvent.clipboardUpdated, history)
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
  writeOsClipboard(text)
  lastText = text
}

function poll(): void {
  if (!captureEnabled) return
  try {
    const text = readClipboardText()
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
  lastText = readClipboardText()
  timer = setInterval(poll, 800)
}

export function stopClipboardWatch(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
