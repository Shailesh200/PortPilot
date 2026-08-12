import { BrowserWindow, app } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  JsonDiffSnapshotInput,
  JsonFormatterSnapshotInput,
  TextDiffSnapshotInput,
  TextSnapshot,
  TextSnapshotTool
} from '../../../shared/types'

const MAX_ITEMS = 100
let snapshots: TextSnapshot[] = []
let snapshotsLoaded = false

function filePath(): string {
  return join(app.getPath('userData'), 'text-tool-snapshots.json')
}

function persist(): void {
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const target = filePath()
    const tmp = `${target}.tmp`
    writeFileSync(tmp, JSON.stringify({ items: snapshots }, null, 2), 'utf-8')
    renameSync(tmp, target)
  } catch {
    /* ignore */
  }
}

function broadcast(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('text-snapshots-updated', snapshots)
  }
}

function isTool(v: unknown): v is TextSnapshotTool {
  return v === 'json-diff' || v === 'json-formatter' || v === 'text-diff'
}

function normalizeItem(raw: unknown): TextSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isTool(o.tool)) return null
  if (typeof o.id !== 'string' || typeof o.createdAt !== 'number') return null
  const label = typeof o.label === 'string' ? o.label : ''
  const updatedAt =
    typeof o.updatedAt === 'number' ? o.updatedAt : o.createdAt

  if (o.tool === 'json-diff') {
    if (typeof o.left !== 'string' || typeof o.right !== 'string') return null
    return {
      id: o.id,
      tool: 'json-diff',
      label,
      createdAt: o.createdAt,
      updatedAt,
      left: o.left,
      right: o.right,
      mode: o.mode === 'line' ? 'line' : 'semantic',
      ignoreKeyOrder: o.ignoreKeyOrder !== false
    }
  }

  if (o.tool === 'text-diff') {
    if (typeof o.left !== 'string' || typeof o.right !== 'string') return null
    return {
      id: o.id,
      tool: 'text-diff',
      label,
      createdAt: o.createdAt,
      updatedAt,
      left: o.left,
      right: o.right,
      split: o.split !== false
    }
  }

  if (typeof o.input !== 'string') return null
  return {
    id: o.id,
    tool: 'json-formatter',
    label,
    createdAt: o.createdAt,
    updatedAt,
    input: o.input,
    mode: o.mode === 'raw' ? 'raw' : 'tree',
    indent: o.indent === '4' || o.indent === '0' ? o.indent : '2',
    sortKeys: Boolean(o.sortKeys)
  }
}

export function loadTextSnapshots(): TextSnapshot[] {
  if (snapshotsLoaded) return snapshots
  snapshotsLoaded = true
  try {
    const p = filePath()
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf-8')) as {
        items?: unknown[]
      }
      if (Array.isArray(raw.items)) {
        snapshots = raw.items
          .map(normalizeItem)
          .filter((x): x is TextSnapshot => x != null)
          .slice(0, MAX_ITEMS)
      }
    }
  } catch {
    snapshots = []
  }
  return snapshots
}

export function listTextSnapshots(tool?: TextSnapshotTool): TextSnapshot[] {
  if (!tool) return snapshots
  return snapshots.filter((s) => s.tool === tool)
}

export function saveTextSnapshot(
  input:
    | JsonDiffSnapshotInput
    | JsonFormatterSnapshotInput
    | TextDiffSnapshotInput
): TextSnapshot[] {
  const now = Date.now()
  const label =
    typeof input.label === 'string' ? input.label.trim() : ''

  let item: TextSnapshot
  if (input.tool === 'json-diff') {
    item = {
      id: randomUUID(),
      tool: 'json-diff',
      label,
      createdAt: now,
      updatedAt: now,
      left: String(input.left ?? ''),
      right: String(input.right ?? ''),
      mode: input.mode === 'line' ? 'line' : 'semantic',
      ignoreKeyOrder: input.ignoreKeyOrder !== false
    }
  } else if (input.tool === 'text-diff') {
    item = {
      id: randomUUID(),
      tool: 'text-diff',
      label,
      createdAt: now,
      updatedAt: now,
      left: String(input.left ?? ''),
      right: String(input.right ?? ''),
      split: input.split !== false
    }
  } else {
    item = {
      id: randomUUID(),
      tool: 'json-formatter',
      label,
      createdAt: now,
      updatedAt: now,
      input: String(input.input ?? ''),
      mode: input.mode === 'raw' ? 'raw' : 'tree',
      indent:
        input.indent === '4' || input.indent === '0' ? input.indent : '2',
      sortKeys: Boolean(input.sortKeys)
    }
  }

  snapshots = [item, ...snapshots].slice(0, MAX_ITEMS)
  persist()
  broadcast()
  return listTextSnapshots(item.tool)
}

export function updateTextSnapshotLabel(
  id: string,
  label: string
): TextSnapshot[] {
  const next = String(label ?? '').trim()
  const now = Date.now()
  let tool: TextSnapshotTool | undefined
  snapshots = snapshots.map((s) => {
    if (s.id !== id) return s
    tool = s.tool
    return { ...s, label: next, updatedAt: now }
  })
  persist()
  broadcast()
  return listTextSnapshots(tool)
}

export function deleteTextSnapshot(id: string): TextSnapshot[] {
  const prev = snapshots.find((s) => s.id === id)
  snapshots = snapshots.filter((s) => s.id !== id)
  persist()
  broadcast()
  return listTextSnapshots(prev?.tool)
}
