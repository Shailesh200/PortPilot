import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { ClipboardItem } from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { useTextToolSessionStore } from '../../stores/textToolSessionStore'
import { ModuleFrame } from '../../shell/ModuleFrame'
import { ToolButton, ToolToggle } from '../text/tools/toolUi'

const kindColor: Record<string, string> = {
  json: 'bg-info/15 text-info',
  url: 'bg-accent/15 text-accent',
  color: 'bg-warning/15 text-warning',
  code: 'bg-success/15 text-success',
  jwt: 'bg-danger/15 text-danger',
  text: 'bg-bg-elevated text-text-muted'
}

export function ClipboardModule() {
  const addToast = useUIStore((s) => s.addToast)
  const setNav = useUIStore((s) => s.setNav)
  const saved = useTextToolSessionStore.getState().clipboardUi
  const patchUi = useTextToolSessionStore((s) => s.patchClipboardUi)

  const [items, setItems] = useState<ClipboardItem[]>([])
  const [capture, setCapture] = useState(false)
  const [query, setQuery] = useState(saved.query)
  const [selectedId, setSelectedId] = useState<string | null>(saved.selectedId)

  useEffect(() => {
    void window.api.clipboardGetHistory().then(setItems)
    void window.api.clipboardIsCaptureEnabled().then(setCapture)
    return window.api.onClipboardUpdate(setItems)
  }, [])

  useEffect(() => {
    patchUi({ query, selectedId })
  }, [query, selectedId, patchUi])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return items
    return items.filter(
      (i) => i.text.toLowerCase().includes(q) || i.kind.includes(q)
    )
  }, [items, query])

  const selected = filtered.find((i) => i.id === selectedId) || filtered[0]

  const deleteItem = async (id: string) => {
    const next = await window.api.clipboardDelete(id)
    setItems(next)
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null)
    }
    addToast({ type: 'success', title: 'Deleted', message: 'Clip removed' })
  }

  return (
    <ModuleFrame
      title="Clipboard History"
      subtitle="Searchable history with type badges and pins"
      showBack
      backLabel="Text & Data"
      onBack={() => setNav({ module: 'text', screen: 'landing' })}
      toolbar={
        <>
          <ToolToggle
            label="Capture"
            checked={capture}
            onChange={async (on) => {
              const enabled = await window.api.clipboardSetCapture(on)
              setCapture(enabled)
              addToast({
                type: 'info',
                title: enabled ? 'Capture on' : 'Capture paused'
              })
            }}
          />
          <ToolButton
            variant="danger"
            onClick={async () => {
              setItems(await window.api.clipboardClear(true))
            }}
          >
            Clear
          </ToolButton>
        </>
      }
    >
      <div className="h-full grid grid-cols-[320px_1fr] min-h-0">
        <div className="border-r border-border-subtle flex flex-col min-h-0">
          <div className="p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clips…"
              className="w-full bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 text-xs text-text-muted">
                {capture
                  ? 'No clips yet — copy something.'
                  : 'Enable Capture to start recording.'}
              </p>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className={clsx(
                    'group flex items-stretch border-b border-border-subtle/50',
                    selected?.id === item.id &&
                      'bg-accent/5 border-l-2 border-l-accent'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className="min-w-0 flex-1 px-4 py-2.5 text-left hover:bg-bg-hover/50"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.5 text-[9px] uppercase',
                          kindColor[item.kind] ?? kindColor.text
                        )}
                      >
                        {item.kind}
                      </span>
                      {item.pinned && (
                        <span className="text-[9px] text-warning">pinned</span>
                      )}
                    </div>
                    <p className="truncate font-mono text-xs text-text-primary">
                      {item.text}
                    </p>
                  </button>
                  <button
                    type="button"
                    title="Delete clip"
                    onClick={(e) => {
                      e.stopPropagation()
                      void deleteItem(item.id)
                    }}
                    className="flex w-9 flex-shrink-0 items-center justify-center text-text-muted opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col min-h-0 p-4">
          {selected ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <ToolButton
                  onClick={() => void window.api.clipboardWrite(selected.text)}
                >
                  Copy
                </ToolButton>
                <ToolButton
                  onClick={async () => {
                    setItems(
                      await window.api.clipboardPin(
                        selected.id,
                        !selected.pinned
                      )
                    )
                  }}
                >
                  {selected.pinned ? 'Unpin' : 'Pin'}
                </ToolButton>
                <ToolButton
                  variant="danger"
                  onClick={() => void deleteItem(selected.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </ToolButton>
              </div>
              <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border-subtle bg-bg-card p-4 font-mono text-xs">
                {selected.text}
              </pre>
            </>
          ) : (
            <p className="text-sm text-text-muted">Select a clip</p>
          )}
        </div>
      </div>
    </ModuleFrame>
  )
}
