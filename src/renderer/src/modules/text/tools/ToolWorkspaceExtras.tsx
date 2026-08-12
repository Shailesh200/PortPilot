import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  Bookmark,
  ChevronDown,
  Maximize2,
  Minimize2,
  Pencil,
  Save,
  Trash2,
  X
} from 'lucide-react'
import { clsx } from 'clsx'
import type {
  JsonDiffSnapshotInput,
  JsonFormatterSnapshotInput,
  TextDiffSnapshotInput,
  TextSnapshot,
  TextSnapshotTool
} from '../../../../../shared/types'
import { ToolButton } from './toolUi'
import { useUIStore } from '../../../stores/uiStore'

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

function displayLabel(item: TextSnapshot): string {
  if (item.label.trim()) return item.label.trim()
  if (item.tool === 'json-diff' || item.tool === 'text-diff') {
    const sample = (item.left || item.right).trim().slice(0, 36)
    if (item.tool === 'text-diff') {
      return sample ? `Text · ${sample}` : 'Untitled text diff'
    }
    return sample ? `Diff · ${sample}` : 'Untitled diff'
  }
  const sample = item.input.trim().slice(0, 36)
  return sample ? `JSON · ${sample}` : 'Untitled JSON'
}

function previewLine(item: TextSnapshot): string {
  if (item.tool === 'json-diff') {
    const a = item.left.trim().length
    const b = item.right.trim().length
    return `${a + b} chars · ${item.mode === 'line' ? 'line' : 'inline'}`
  }
  if (item.tool === 'text-diff') {
    const a = item.left.trim().length
    const b = item.right.trim().length
    return `${a + b} chars · ${item.split ? 'split' : 'stacked'}`
  }
  return `${item.input.trim().length} chars`
}

export function ToolFullscreenShell({ children }: { children: ReactNode }) {
  return <div className="h-full min-h-0 flex flex-col gap-2">{children}</div>
}

function useToolImmersive() {
  const immersive = useUIStore((s) => s.isWorkspaceImmersive)
  const setWorkspaceImmersive = useUIStore((s) => s.setWorkspaceImmersive)

  useEffect(() => {
    return window.api.onWindowFullScreenChange((v) => {
      if (!v) setWorkspaceImmersive(false)
    })
  }, [setWorkspaceImmersive])

  const toggleImmersive = () => {
    const next = !immersive
    setWorkspaceImmersive(next)
    if (next) {
      void window.api.windowIsFullScreen().then((isFs) => {
        if (!isFs) void window.api.windowSetFullScreen(true)
      })
    }
  }

  return { immersive, toggleImmersive }
}

export function ToolImmersiveButton({
  className
}: {
  className?: string
}) {
  const { immersive, toggleImmersive } = useToolImmersive()
  return (
    <button
      type="button"
      title={immersive ? 'Exit focus view' : 'Full screen'}
      onClick={toggleImmersive}
      className={clsx(
        'p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated border border-transparent hover:border-border-subtle',
        className
      )}
    >
      {immersive ? (
        <Minimize2 className="w-4 h-4" />
      ) : (
        <Maximize2 className="w-4 h-4" />
      )}
    </button>
  )
}

export function ToolWorkspaceExtras({
  tool,
  canSave,
  onSavePayload,
  onLoad
}: {
  tool: TextSnapshotTool
  canSave: boolean
  onSavePayload: () =>
    | JsonDiffSnapshotInput
    | JsonFormatterSnapshotInput
    | TextDiffSnapshotInput
    | null
  onLoad: (item: TextSnapshot) => void
}) {
  const addToast = useUIStore((s) => s.addToast)
  const [items, setItems] = useState<TextSnapshot[]>([])
  const [listOpen, setListOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [showLabel, setShowLabel] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(
    () => items.filter((i) => i.tool === tool),
    [items, tool]
  )

  useEffect(() => {
    let cancelled = false
    void window.api.textSnapshotsList(tool).then((list) => {
      if (!cancelled) setItems(list)
    })
    const unsub = window.api.onTextSnapshotsUpdate((all) => {
      setItems(all.filter((i) => i.tool === tool))
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [tool])

  useEffect(() => {
    if (!listOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setListOpen(false)
        setEditingId(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setListOpen(false)
        setEditingId(null)
      }
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [listOpen])

  const commitSave = async (label: string) => {
    const payload = onSavePayload()
    if (!payload) return
    setSaving(true)
    try {
      const next = await window.api.textSnapshotsSave({
        ...payload,
        label: label.trim()
      })
      setItems(next)
      setShowLabel(false)
      setLabelDraft('')
      setListOpen(true)
      addToast({
        type: 'success',
        title: 'Saved',
        message: label.trim() || 'Available in Saved list'
      })
    } catch {
      addToast({ type: 'error', title: 'Could not save' })
    } finally {
      setSaving(false)
    }
  }

  const startSave = () => {
    if (!canSave || saving) return
    setShowLabel(true)
    setLabelDraft('')
  }

  const onDelete = async (id: string) => {
    try {
      const next = await window.api.textSnapshotsDelete(id)
      setItems(next)
    } catch {
      addToast({ type: 'error', title: 'Could not delete' })
    }
  }

  const onRename = async (id: string) => {
    try {
      const next = await window.api.textSnapshotsUpdateLabel(id, editLabel)
      setItems(next)
      setEditingId(null)
      setEditLabel('')
    } catch {
      addToast({ type: 'error', title: 'Could not rename' })
    }
  }

  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 min-h-[28px]">
      <ToolButton
        variant="ghost"
        disabled={!canSave || saving}
        onClick={startSave}
        title="Save for later"
      >
        <Save className="w-3.5 h-3.5" />
        Save
      </ToolButton>

      <div ref={dropdownRef} className="relative">
        <ToolButton
          variant={listOpen ? 'default' : 'ghost'}
          onClick={() => setListOpen((v) => !v)}
          title="Saved items"
        >
          <Bookmark className="w-3.5 h-3.5" />
          Saved
          {filtered.length > 0 && (
            <span className="text-[10px] tabular-nums text-text-muted">
              {filtered.length}
            </span>
          )}
          <ChevronDown
            className={clsx(
              'w-3.5 h-3.5 text-text-muted transition-transform',
              listOpen && 'rotate-180'
            )}
          />
        </ToolButton>

        {listOpen && (
          <div className="absolute left-0 top-full mt-1.5 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border-subtle bg-bg-card shadow-xl shadow-black/25 overflow-hidden flex flex-col max-h-64">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-text-muted">
                No saved{' '}
                {tool === 'json-diff'
                  ? 'diffs'
                  : tool === 'text-diff'
                    ? 'text diffs'
                    : 'JSON'}{' '}
                yet. Use Save to keep the current workspace.
              </p>
            ) : (
              <ul className="overflow-y-auto divide-y divide-border-subtle">
                {filtered.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover/60 group"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        onLoad(item)
                        setListOpen(false)
                        addToast({
                          type: 'info',
                          title: 'Loaded',
                          message: displayLabel(item)
                        })
                      }}
                      title="Load"
                    >
                      {editingId === item.id ? (
                        <input
                          autoFocus
                          value={editLabel}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void onRename(item.id)
                            } else if (e.key === 'Escape') {
                              setEditingId(null)
                            }
                          }}
                          onBlur={() => void onRename(item.id)}
                          className="w-full bg-bg-elevated border border-border-strong rounded px-2 py-0.5 text-[12.5px] text-text-primary focus:outline-none focus:border-accent"
                        />
                      ) : (
                        <>
                          <div className="text-[12.5px] font-medium text-text-primary truncate">
                            {displayLabel(item)}
                          </div>
                          <div className="text-[11px] text-text-muted truncate">
                            {formatWhen(item.createdAt)}
                            <span className="mx-1.5 text-border-strong">·</span>
                            {previewLine(item)}
                          </div>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(item.id)
                        setEditLabel(item.label || displayLabel(item))
                      }}
                      className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-elevated opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        void onDelete(item.id)
                      }}
                      className="p-1.5 rounded-full text-text-muted hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showLabel && (
        <form
          className="flex items-center gap-1.5 min-w-0 flex-1 max-w-md"
          onSubmit={(e) => {
            e.preventDefault()
            void commitSave(labelDraft)
          }}
        >
          <input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="Optional label…"
            className="flex-1 min-w-0 bg-bg-elevated border border-border-strong rounded-full px-3 py-1.5 text-[12.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <ToolButton
            variant="primary"
            disabled={saving}
            onClick={() => void commitSave(labelDraft)}
          >
            Confirm
          </ToolButton>
          <button
            type="button"
            title="Cancel"
            onClick={() => {
              setShowLabel(false)
              setLabelDraft('')
            }}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      <ToolImmersiveButton className="ml-auto" />
    </div>
  )
}
