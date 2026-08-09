import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import type { ClipboardItem } from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { useHandoffStore } from '../../stores/handoffStore'
import { detectContent, jwtPreview } from '../../lib/detectContent'
import { ModuleFrame } from '../../shell/ModuleFrame'
import { ToolButton } from '../text/tools/toolUi'

const kindColor: Record<string, string> = {
  json: 'bg-info/15 text-info',
  url: 'bg-accent/15 text-accent',
  color: 'bg-warning/15 text-warning',
  code: 'bg-success/15 text-success',
  jwt: 'bg-danger/15 text-danger',
  text: 'bg-bg-elevated text-text-muted'
}

export function ClipboardModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const addToast = useUIStore((s) => s.addToast)
  const navigateWithPayload = useHandoffStore((s) => s.navigateWithPayload)
  const screen = nav.module === 'clipboard' ? nav.screen : 'history'

  const [items, setItems] = useState<ClipboardItem[]>([])
  const [capture, setCapture] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    void window.api.clipboardGetHistory().then(setItems)
    void window.api.clipboardIsCaptureEnabled().then(setCapture)
    return window.api.onClipboardUpdate(setItems)
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return items
    return items.filter(
      (i) => i.text.toLowerCase().includes(q) || i.kind.includes(q)
    )
  }, [items, query])

  const selected = filtered.find((i) => i.id === selectedId) || filtered[0]

  if (screen === 'transforms') {
    const sample = selected?.text || ''
    const kind = detectContent(sample)
    return (
      <ModuleFrame
        title="Smart Transforms"
        subtitle="Detect clipboard content and jump to the right tool"
        toolbar={
          <ToolButton
            onClick={() => setNav({ module: 'clipboard', screen: 'history' })}
          >
            History
          </ToolButton>
        }
      >
        <div className="p-6 max-w-2xl space-y-4">
          {!capture && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
              <p className="text-warning font-medium">Capture is off</p>
              <p className="text-xs text-text-muted mt-1">
                Enable clipboard capture to build history. Opt-in for privacy.
              </p>
              <button
                className="mt-3 text-xs px-3 py-1.5 rounded-md bg-accent text-white"
                onClick={async () => {
                  const on = await window.api.clipboardSetCapture(true)
                  setCapture(on)
                }}
              >
                Enable capture
              </button>
            </div>
          )}
          <div className="rounded-xl border border-border-subtle bg-bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-text-muted">Detected</span>
              <span
                className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded uppercase',
                  kindColor[kind]
                )}
              >
                {kind}
              </span>
            </div>
            <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all max-h-40 overflow-auto">
              {sample || 'Select an item from History, or copy something.'}
            </pre>
          </div>
          <div className="grid gap-2">
            {kind === 'json' && (
              <Action
                label="Open in JSON Formatter"
                onClick={() =>
                  navigateWithPayload(
                    { module: 'text', screen: 'json-formatter' },
                    sample
                  )
                }
              />
            )}
            {kind === 'jwt' && (
              <>
                <div className="rounded-xl border border-border-subtle p-3">
                  <p className="text-xs text-text-muted mb-1">
                    JWT payload preview (full decoder out of scope)
                  </p>
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {jwtPreview(sample) || 'Could not decode payload'}
                  </pre>
                </div>
                <Action
                  label="Open payload in JSON Formatter"
                  onClick={() => {
                    const p = jwtPreview(sample)
                    if (p)
                      navigateWithPayload(
                        { module: 'text', screen: 'json-formatter' },
                        p
                      )
                  }}
                />
              </>
            )}
            {kind === 'url' && (
              <Action
                label="Copy URL"
                onClick={() => void window.api.clipboardWrite(sample)}
              />
            )}
            {kind === 'color' && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border-subtle">
                <div
                  className="w-10 h-10 rounded-lg border border-border"
                  style={{ background: sample }}
                />
                <span className="text-sm font-mono">{sample}</span>
              </div>
            )}
            {(kind === 'code' || kind === 'text') && (
              <Action
                label="Open in Text Diff"
                onClick={() =>
                  navigateWithPayload(
                    { module: 'text', screen: 'text-diff' },
                    sample
                  )
                }
              />
            )}
          </div>
        </div>
      </ModuleFrame>
    )
  }

  return (
    <ModuleFrame
      title="Clipboard History"
      subtitle="Searchable history with type badges and pins"
      toolbar={
        <>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary mr-2">
            <input
              type="checkbox"
              checked={capture}
              onChange={async (e) => {
                const on = await window.api.clipboardSetCapture(e.target.checked)
                setCapture(on)
                addToast({
                  type: 'info',
                  title: on ? 'Capture on' : 'Capture paused'
                })
              }}
            />
            Capture
          </label>
          <ToolButton
            onClick={() => setNav({ module: 'clipboard', screen: 'transforms' })}
          >
            Transforms
          </ToolButton>
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
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={clsx(
                    'w-full text-left px-4 py-2.5 border-b border-border-subtle/50 hover:bg-bg-hover/50',
                    selected?.id === item.id && 'bg-accent/5 border-l-2 border-l-accent'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={clsx(
                        'text-[9px] px-1.5 py-0.5 rounded uppercase',
                        kindColor[item.kind]
                      )}
                    >
                      {item.kind}
                    </span>
                    {item.pinned && (
                      <span className="text-[9px] text-warning">pinned</span>
                    )}
                  </div>
                  <p className="text-xs text-text-primary truncate font-mono">
                    {item.text}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col min-h-0 p-4">
          {selected ? (
            <>
              <div className="flex items-center gap-2 mb-3">
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
                  variant="primary"
                  onClick={() =>
                    setNav({ module: 'clipboard', screen: 'transforms' })
                  }
                >
                  Transforms
                </ToolButton>
              </div>
              <pre className="flex-1 overflow-auto text-xs font-mono bg-bg-card border border-border-subtle rounded-xl p-4 whitespace-pre-wrap break-all">
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

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl border border-border-subtle bg-bg-card hover:border-accent/40 text-sm"
    >
      {label}
    </button>
  )
}
