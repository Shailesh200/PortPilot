import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import { useHandoffPayload } from '../../../hooks/useHandoffPayload'
import { useUIStore } from '../../../stores/uiStore'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import {
  ToolBadge,
  ToolButton,
  ToolPane,
  ToolToolbar
} from './toolUi'
import { ToolFullscreenShell } from './ToolWorkspaceExtras'
import { ToolPasteCopy } from './toolChrome'
import {
  clockParts,
  isoInZone,
  parseTimeQuery,
  snapshotAt,
  timeRows,
  type TimeRow,
  type TimeRowKind,
  type TimeSnapshot,
  type TimeSource
} from '../../../../../shared/time-convert'

function liveNow(): TimeSnapshot {
  return snapshotAt(Date.now(), 'now')
}

function sourceLabel(source: TimeSource): string {
  switch (source) {
    case 'epoch-s':
      return 'Epoch seconds'
    case 'epoch-ms':
      return 'Epoch ms'
    case 'iso':
      return 'ISO / date'
    default:
      return 'Live'
  }
}

const LIVE_ZONES = [
  { id: 'local', label: 'Local', tz: undefined as string | undefined },
  { id: 'utc', label: 'UTC', tz: 'UTC' },
  { id: 'edt', label: 'EDT', tz: 'America/New_York' }
] as const

const GROUPS: { id: TimeRow['group']; title: string }[] = [
  { id: 'zones', title: 'Wall clock' },
  { id: 'iso', title: 'ISO' },
  { id: 'epoch', title: 'Epoch' },
  { id: 'code', title: 'Code' }
]

function Highlighted({
  kind,
  value
}: {
  kind: TimeRowKind
  value: string
}): ReactNode {
  if (kind === 'iso') {
    const iso = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|[+-]\d{2}:\d{2})$/
    )
    if (iso) {
      return (
        <>
          <span className="text-info">{iso[1]}</span>
          <span className="text-text-muted">-</span>
          <span className="text-info">{iso[2]}</span>
          <span className="text-text-muted">-</span>
          <span className="text-info">{iso[3]}</span>
          <span className="text-text-muted">T</span>
          <span className="text-success">
            {iso[4]}:{iso[5]}:{iso[6]}
          </span>
          {iso[7] ? <span className="text-text-muted">.{iso[7]}</span> : null}
          <span className="text-accent">{iso[8]}</span>
        </>
      )
    }
    const compact = value.match(/^(\d{8})T(\d{6})Z$/)
    if (compact) {
      return (
        <>
          <span className="text-info">{compact[1]}</span>
          <span className="text-text-muted">T</span>
          <span className="text-success">{compact[2]}</span>
          <span className="text-accent">Z</span>
        </>
      )
    }
    return value
  }
  if (kind === 'sql' || kind === 'date') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2}))?$/)
    if (!m) return value
    return (
      <>
        <span className="text-info">{m[1]}</span>
        {m[2] ? (
          <>
            <span className="text-text-muted"> </span>
            <span className="text-success">{m[2]}</span>
          </>
        ) : null}
      </>
    )
  }
  if (kind === 'epoch') {
    const [whole, frac] = value.split('.')
    return (
      <span className="tabular-nums">
        <span className="text-warning">{whole}</span>
        {frac != null ? (
          <>
            <span className="text-text-muted">.</span>
            <span className="text-accent">{frac}</span>
          </>
        ) : null}
      </span>
    )
  }
  if (kind === 'js') {
    const m = value.match(/^(new Date\()(\d+)(\))$/)
    if (!m) return value
    return (
      <>
        <span className="text-text-muted">{m[1]}</span>
        <span className="text-warning tabular-nums">{m[2]}</span>
        <span className="text-text-muted">{m[3]}</span>
      </>
    )
  }
  if (kind === 'rfc' || kind === 'wall') {
    const m = value.match(/^(.*?)(\d{2}:\d{2}:\d{2})(.*)$/)
    if (!m) return value
    return (
      <>
        <span className="text-text-secondary">{m[1]}</span>
        <span className="text-success">{m[2]}</span>
        <span className="text-accent">{m[3]}</span>
      </>
    )
  }
  return <span className="text-text-primary">{value}</span>
}

export function TimeBench() {
  const saved = useTextToolSessionStore.getState().timeBench
  const patch = useTextToolSessionStore((s) => s.patchTimeBench)
  const addToast = useUIStore((s) => s.addToast)
  const [input, setInput] = useState(saved.input)
  const [clock, setClock] = useState(liveNow)
  const [copied, setCopied] = useState<string | null>(null)

  useHandoffPayload((payload) => setInput(payload.trim()))

  useEffect(() => {
    patch({ input })
  }, [input, patch])

  useEffect(() => {
    const id = window.setInterval(() => setClock(liveNow()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const parsed = useMemo(() => {
    const q = input.trim()
    if (!q) return { snap: clock, error: null as string | null }
    const snap = parseTimeQuery(q, clock.ms)
    if (!snap) return { snap: null, error: 'Could not parse that timestamp' }
    return { snap, error: null }
  }, [input, clock])

  const snap = parsed.snap
  const live = !input.trim()
  const rows = snap ? timeRows(snap) : []

  const copyValue = (value: string, label: string) => {
    void navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1200)
    addToast({ type: 'success', title: 'Copied', message: label })
  }

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          <ToolButton
            variant={live ? 'primary' : 'default'}
            onClick={() => setInput('')}
          >
            Now
          </ToolButton>
          <ToolButton
            variant="default"
            onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}
          >
            Epoch
          </ToolButton>
          <ToolButton
            variant="default"
            onClick={() => setInput(new Date().toISOString())}
          >
            UTC ISO
          </ToolButton>
          <ToolPasteCopy
            onPaste={(text) => setInput(text.trim())}
            pasteOnly
          />
        </ToolToolbar>
      </WorkspaceToolbar>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LIVE_ZONES.map((zone, i) => {
          const parts = clockParts(clock.ms, zone.tz)
          const iso = isoInZone(clock.ms, zone.tz)
          const featured = i === 0
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => copyValue(iso, `${zone.label} ISO`)}
              title={`Copy ${zone.label} ISO`}
              className={clsx(
                'group relative rounded-2xl border px-5 py-4 text-left transition-colors',
                featured
                  ? 'border-accent/25 bg-accent/[0.06] hover:border-accent/50'
                  : 'border-border-subtle bg-bg-card hover:border-accent/35'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {zone.label}
                </span>
                {featured && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-success/80 animate-ping" />
                    <span className="relative rounded-full h-1.5 w-1.5 bg-success" />
                  </span>
                )}
                <Copy className="ml-auto w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p
                className={clsx(
                  'mt-2 font-mono tabular-nums tracking-tight text-text-primary',
                  featured ? 'text-[28px] leading-none' : 'text-[22px] leading-none'
                )}
              >
                {parts.time}
              </p>
              <p className="mt-2 text-[12px] text-text-secondary">{parts.date}</p>
              <p className="mt-0.5 text-[11px] font-mono text-text-muted">
                {parts.offset || zone.label}
              </p>
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-card px-3 py-2 focus-within:border-accent/45">
        <span className="sr-only">Timestamp</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          placeholder="Paste epoch, ISO, now, now ist…"
          className="flex-1 min-w-0 bg-transparent px-1 py-1.5 font-mono text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {parsed.error ? (
          <ToolBadge tone="err">Unparsed</ToolBadge>
        ) : snap ? (
          <ToolBadge tone={live ? 'info' : 'ok'}>
            {live ? 'Live now' : sourceLabel(snap.source)}
          </ToolBadge>
        ) : null}
        {input ? (
          <button
            type="button"
            onClick={() => setInput('')}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </label>

      <ToolPane
        title="Conversions"
        className="flex-1 min-h-0"
        actions={
          snap ? (
            <span className="text-[11px] text-text-muted">{snap.relative}</span>
          ) : null
        }
        bodyClassName="p-2 h-full overflow-auto"
      >
        {parsed.error ? (
          <p className="px-3 py-2 text-[13px] text-danger">{parsed.error}</p>
        ) : (
          <div className="space-y-3">
            {GROUPS.map((group) => {
              const items = rows.filter((r) => r.group === group.id)
              if (items.length === 0) return null
              return (
                <div key={group.id}>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {group.title}
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {items.map((row) => {
                      const isCopied = copied === row.label
                      return (
                        <li key={row.label}>
                          <button
                            type="button"
                            onClick={() => copyValue(row.value, row.label)}
                            className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-bg-elevated/80 transition-colors group"
                          >
                            <span className="w-[88px] shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted pt-0.5">
                              {row.label}
                            </span>
                            <span className="flex-1 min-w-0 font-mono text-[12.5px] leading-5 break-all">
                              <Highlighted kind={row.kind} value={row.value} />
                            </span>
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-text-muted opacity-50 group-hover:opacity-100 shrink-0 mt-0.5" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </ToolPane>
    </ToolFullscreenShell>
  )
}
