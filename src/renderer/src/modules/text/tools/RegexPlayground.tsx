import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import { useHandoffPayload } from '../../../hooks/useHandoffPayload'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import {
  ToolBadge,
  ToolPane,
  ToolToggle,
  ToolToolbar
} from './toolUi'
import { ToolFullscreenShell } from './ToolWorkspaceExtras'
import { ToolPasteCopy } from './toolChrome'
import {
  explainRegex,
  TOKEN_CLASS,
  walkNodes,
  type RegexNode
} from '../../../lib/regexExplain'
import { SplitPane } from '../../../shell/SplitPane'

const FLAG_OPTS = ['g', 'i', 'm', 's', 'u'] as const

function compile(
  pattern: string,
  flags: string
): { ok: true; re: RegExp } | { ok: false; error: string } {
  if (!pattern) return { ok: false, error: '' }
  try {
    return { ok: true, re: new RegExp(pattern, flags) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid regular expression'
    }
  }
}

function matchOne(
  text: string,
  reSrc: string,
  flags: string
): { index: number; text: string; groups: string[] }[] {
  const flagsG = flags.includes('g') ? flags : `${flags}g`
  const re = new RegExp(reSrc, flagsG)
  const out: { index: number; text: string; groups: string[] }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ index: m.index, text: m[0], groups: m.slice(1) })
    if (m[0].length === 0) re.lastIndex++
    if (out.length >= 80) break
  }
  return out
}

function highlight(text: string, re: RegExp | null): ReactNode {
  if (!re || !text) return text
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const global = new RegExp(re.source, flags)
  const parts: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = global.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <mark
        key={`${m.index}-${i++}`}
        className="rounded bg-warning/30 text-warning px-0.5"
      >
        {m[0] || '∅'}
      </mark>
    )
    last = m.index + m[0].length
    if (m[0].length === 0) global.lastIndex++
    if (!flags.includes('g')) break
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function PatternHighlight({
  pattern,
  nodes,
  hovered,
  onHover
}: {
  pattern: string
  nodes: RegexNode[]
  hovered: string | null
  onHover: (id: string | null) => void
}) {
  const cover: (RegexNode | undefined)[] = new Array(pattern.length)
  walkNodes(nodes, (n) => {
    for (let i = n.start; i < n.end && i < pattern.length; i++) cover[i] = n
  })
  let hoveredNode: RegexNode | undefined
  walkNodes(nodes, (n) => {
    if (n.id === hovered) hoveredNode = n
  })
  const parts: ReactNode[] = []
  let i = 0
  while (i < pattern.length) {
    const node = cover[i]
    if (!node) {
      parts.push(pattern[i])
      i += 1
      continue
    }
    let j = i + 1
    while (j < pattern.length && cover[j]?.id === node.id) j += 1
    const active = Boolean(
      hoveredNode &&
        node.start >= hoveredNode.start &&
        node.end <= hoveredNode.end
    )
    parts.push(
      <span
        key={`${node.id}-${i}`}
        title={node.detail}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        className={clsx(
          'rounded-sm cursor-default',
          TOKEN_CLASS[node.kind],
          active && 'bg-accent/25'
        )}
      >
        {pattern.slice(i, j)}
      </span>
    )
    i = j
  }
  return (
    <p className="font-mono text-[13px] leading-6 whitespace-pre-wrap break-all">
      {parts}
    </p>
  )
}

function ExplainRow({
  node,
  hovered,
  onHover,
  depth = 0
}: {
  node: RegexNode
  hovered: string | null
  onHover: (id: string | null) => void
  depth?: number
}) {
  const active = hovered === node.id
  return (
    <div>
      <button
        type="button"
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        className={clsx(
          'w-full text-left rounded-md py-1 pr-2',
          active ? 'bg-accent/15' : 'hover:bg-bg-hover/70'
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span className="flex items-baseline gap-2 min-w-0">
          <span
            className={clsx(
              'font-mono text-[12px] flex-shrink-0',
              TOKEN_CLASS[node.kind]
            )}
          >
            {node.quant
              ? node.text.slice(0, Math.max(0, node.text.length - node.quant.text.length))
              : node.text}
            {node.quant ? (
              <span className="text-warning">{node.quant.text}</span>
            ) : null}
          </span>
          <span className="text-[12.5px] text-text-primary truncate">
            {node.title}
            {node.quant ? ` · ${node.quant.title}` : ''}
          </span>
        </span>
        <span className="block text-[11.5px] leading-4 text-text-muted mt-0.5">
          {node.detail}
        </span>
      </button>
      {node.children?.map((c) => (
        <ExplainRow
          key={c.id}
          node={c}
          hovered={hovered}
          onHover={onHover}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export function RegexPlayground() {
  const saved = useTextToolSessionStore.getState().regexPlayground
  const patch = useTextToolSessionStore((s) => s.patchRegexPlayground)
  const lineByLineSetting = useSettingsStore((s) => s.regexLineByLine)
  const [pattern, setPattern] = useState(saved.pattern)
  const [flags, setFlags] = useState(saved.flags || 'gm')
  const [samples, setSamples] = useState<string[]>(() => {
    const s = saved.sample
    if (!s) return ['']
    return s.includes('\n---\n') ? s.split('\n---\n') : [s]
  })
  const [replace, setReplace] = useState(saved.replace)
  const [lineByLine, setLineByLine] = useState(lineByLineSetting)
  const [hovered, setHovered] = useState<string | null>(null)
  const [splitPct, setSplitPct] = useState(50)
  const [explainPct, setExplainPct] = useState(48)
  const [headPct, setHeadPct] = useState(28)
  const [matchPct, setMatchPct] = useState(68)

  useHandoffPayload((payload) => setSamples([payload]))

  useEffect(() => {
    patch({
      pattern,
      flags,
      sample: samples.join('\n---\n'),
      replace
    })
  }, [pattern, flags, samples, replace, patch])

  const compiled = useMemo(() => compile(pattern, flags), [pattern, flags])
  const tokens = useMemo(() => explainRegex(pattern), [pattern])

  const cases = useMemo(() => {
    const list: { label: string; text: string }[] = []
    samples.forEach((s, i) => {
      if (lineByLine) {
        const lines = s.split(/\r?\n/)
        if (lines.length === 0) lines.push('')
        lines.forEach((line, li) => {
          list.push({
            label: samples.length > 1 ? `S${i + 1} L${li + 1}` : `L${li + 1}`,
            text: line
          })
        })
      } else {
        list.push({
          label: samples.length > 1 ? `String ${i + 1}` : 'String',
          text: s
        })
      }
    })
    return list
  }, [samples, lineByLine])

  const results = useMemo(() => {
    if (!compiled.ok) return []
    return cases.map((c) => ({
      ...c,
      matches: matchOne(c.text, compiled.re.source, compiled.re.flags)
    }))
  }, [compiled, cases])

  const totalMatches = results.reduce((n, r) => n + r.matches.length, 0)

  const replaced = useMemo(() => {
    if (!compiled.ok) return ''
    try {
      return samples
        .map((s) => s.replace(compiled.re, replace))
        .join('\n---\n')
    } catch {
      return ''
    }
  }, [compiled, samples, replace])

  const toggleFlag = (flag: string) => {
    setFlags((prev) =>
      prev.includes(flag) ? prev.replace(flag, '') : `${prev}${flag}`
    )
  }

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-text-muted">/</span>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="pattern"
              spellCheck={false}
              className="min-w-0 flex-1 bg-bg-elevated border border-border-strong rounded-full px-3 py-1.5 font-mono text-[13px] text-text-primary focus:outline-none focus:border-accent"
            />
            <span className="font-mono text-text-muted">/</span>
            <div className="flex items-center gap-0.5">
              {FLAG_OPTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFlag(f)}
                  className={clsx(
                    'h-7 w-7 rounded-md font-mono text-[12px]',
                    flags.includes(f)
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-muted hover:bg-bg-elevated'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {compiled.ok ? (
            <ToolBadge tone="ok">
              {totalMatches} match{totalMatches === 1 ? '' : 'es'}
            </ToolBadge>
          ) : pattern ? (
            <ToolBadge tone="err">Invalid</ToolBadge>
          ) : null}
          <ToolToggle
            label="Line by line"
            checked={lineByLine}
            onChange={(v) => {
              setLineByLine(v)
              useSettingsStore.getState().updateSettings({ regexLineByLine: v })
            }}
          />
          <ToolPasteCopy
            onPaste={(text) => setSamples([text])}
            copyText={replaced}
            copyDisabled={!replaced}
            copyLabel="Copy result"
          />
        </ToolToolbar>
      </WorkspaceToolbar>

      {!compiled.ok && compiled.error && (
        <p className="mb-2 text-[12px] text-danger">{compiled.error}</p>
      )}

      {(() => {
        const tests = (
          <SplitPane
            axis="x"
            value={splitPct}
            onChange={setSplitPct}
            className="h-full"
          >
            <ToolPane
              className="h-full min-h-0"
              title="Test strings"
              actions={
                <button
                  type="button"
                  onClick={() => setSamples((s) => [...s, ''])}
                  className="text-[11px] text-accent inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add string
                </button>
              }
              bodyClassName="p-2 h-full overflow-auto space-y-2"
            >
              {samples.map((s, i) => (
                <div key={i} className="relative">
                  <textarea
                    className="w-full min-h-[88px] resize-y rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-[13px] leading-6 font-mono text-text-primary focus:outline-none focus:border-accent"
                    value={s}
                    onChange={(e) =>
                      setSamples((prev) =>
                        prev.map((x, idx) => (idx === i ? e.target.value : x))
                      )
                    }
                    spellCheck={false}
                    placeholder={
                      lineByLine
                        ? 'One test per line — ^ $ apply to each line when /m is on'
                        : 'Text to test…'
                    }
                  />
                  {samples.length > 1 && (
                    <button
                      type="button"
                      className="absolute top-2 right-2 p-1 text-text-muted hover:text-danger"
                      onClick={() =>
                        setSamples((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </ToolPane>
            <SplitPane
              axis="y"
              value={matchPct}
              onChange={setMatchPct}
              min={30}
              max={85}
              className="h-full"
            >
              <ToolPane
                title="Matches"
                className="h-full min-h-0"
                bodyClassName="p-3 overflow-auto space-y-3"
              >
                {results.map((r, i) => (
                  <div key={`${r.label}-${i}`}>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                      {r.label} · {r.matches.length}
                    </p>
                    <p className="font-mono text-[13px] leading-6 whitespace-pre-wrap text-text-primary">
                      {compiled.ok
                        ? highlight(r.text, compiled.re)
                        : r.text || '∅'}
                    </p>
                  </div>
                ))}
              </ToolPane>
              <ToolPane
                title="Replace"
                className="h-full min-h-0"
                actions={
                  <input
                    value={replace}
                    onChange={(e) => setReplace(e.target.value)}
                    placeholder="$1 / replacement"
                    spellCheck={false}
                    className="w-48 bg-bg-elevated border border-border-strong rounded-full px-3 py-1 font-mono text-[12px] text-text-primary focus:outline-none focus:border-accent"
                  />
                }
                bodyClassName="p-3 overflow-auto"
              >
                <pre className="font-mono text-[12.5px] leading-5 whitespace-pre-wrap text-text-primary">
                  {replaced || '—'}
                </pre>
              </ToolPane>
            </SplitPane>
          </SplitPane>
        )

        if (tokens.length === 0) {
          return <div className="flex-1 min-h-0">{tests}</div>
        }

        return (
          <SplitPane
            axis="y"
            value={headPct}
            onChange={setHeadPct}
            min={14}
            max={55}
            className="flex-1"
          >
            <SplitPane
              axis="x"
              value={explainPct}
              onChange={setExplainPct}
              className="h-full"
            >
              <div className="h-full rounded-xl border border-border-subtle bg-bg-card px-3 py-2 overflow-auto">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                  Expression · hover a token
                </p>
                <PatternHighlight
                  pattern={pattern}
                  nodes={tokens}
                  hovered={hovered}
                  onHover={setHovered}
                />
              </div>
              <div className="h-full rounded-xl border border-border-subtle bg-bg-card overflow-auto py-1">
                {tokens.map((n) => (
                  <ExplainRow
                    key={n.id}
                    node={n}
                    hovered={hovered}
                    onHover={setHovered}
                  />
                ))}
              </div>
            </SplitPane>
            {tests}
          </SplitPane>
        )
      })()}
    </ToolFullscreenShell>
  )
}
