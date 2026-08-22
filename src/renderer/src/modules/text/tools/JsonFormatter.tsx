import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react'
import { Copy } from 'lucide-react'
import { clsx } from 'clsx'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import { useHandoffPayload } from '../../../hooks/useHandoffPayload'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import { SplitPane } from '../../../shell/SplitPane'
import {
  ToolBadge,
  ToolButton,
  ToolDivider,
  ToolPane,
  ToolSeg,
  ToolToggle,
  ToolToolbar
} from './toolUi'
import { ToolFindBar, ToolMonoTextarea, readClipboardText } from './toolChrome'
import { countNodes, escapeRegExp, formatJson, parseJson, sortJsonKeys } from './jsonUtils'
import { highlightJson, highlightMarkup } from '../../../lib/syntaxHighlight'
import { prettyCss, prettyHtml, prettyJs, prettyLog } from '../../../lib/prettyPrint'
import {
  ToolFullscreenShell,
  ToolWorkspaceExtras
} from './ToolWorkspaceExtras'
import type { TextSnapshot } from '../../../../../shared/types'

type ViewMode = 'tree' | 'raw'
type IndentMode = '2' | '4' | '0'
type FormatKind = 'json' | 'html' | 'css' | 'js' | 'log'

const MIN_LEFT_PCT = 22
const MAX_LEFT_PCT = 78

function typePill(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `array · ${value.length}`
  if (typeof value === 'object') {
    return `object · ${Object.keys(value as object).length} keys`
  }
  return typeof value
}

function valueColor(value: unknown): string {
  if (typeof value === 'string') return 'text-[#7ecfa2]'
  if (typeof value === 'number') return 'text-[#f5c26b]'
  if (typeof value === 'boolean') return 'text-[#c792ea]'
  if (value === null) return 'text-text-muted'
  return 'text-text-secondary'
}

function highlightString(
  text: string,
  query: string,
  activeGlobalIndex: number,
  startOffset: number
): { nodes: ReactNode; count: number } {
  const q = query.trim()
  if (!q) return { nodes: text, count: 0 }
  const re = new RegExp(escapeRegExp(q), 'gi')
  const parts: ReactNode[] = []
  let last = 0
  let local = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const globalIdx = startOffset + local
    parts.push(
      <mark
        key={`${startOffset}-${local}-${m.index}`}
        data-find-match={String(globalIdx)}
        className={clsx(
          'rounded px-0.5',
          globalIdx === activeGlobalIndex
            ? 'bg-warning/45 text-warning'
            : 'bg-warning/20 text-warning/90'
        )}
      >
        {m[0]}
      </mark>
    )
    local++
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < text.length) parts.push(text.slice(last))
  return { nodes: parts.length ? <>{parts}</> : text, count: local }
}

function countOccurrences(text: string, query: string): number {
  const q = query.trim()
  if (!q) return 0
  const re = new RegExp(escapeRegExp(q), 'gi')
  return (text.match(re) || []).length
}

function primitiveText(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  return String(value)
}

/**
 * Document-order matches for tree: each path where key or value text contains query.
 * Also returns expand paths so ancestors open around hits.
 */
function collectNodeMatches(
  value: unknown,
  query: string
): {
  orderedPaths: string[]
  expandPaths: Set<string>
  pathHit: Map<string, boolean>
} {
  const orderedPaths: string[] = []
  const expandPaths = new Set<string>()
  const pathHit = new Map<string, boolean>()
  const q = query.trim().toLowerCase()
  if (!q) return { orderedPaths, expandPaths, pathHit }

  const markExpand = (parts: string[]) => {
    for (let i = 1; i <= parts.length; i++) {
      expandPaths.add(parts.slice(0, i).join('.'))
    }
  }

  const walk = (node: unknown, parts: string[], key?: string) => {
    const path = parts.length === 0 ? 'root' : parts.join('.')
    const keyHit = key != null && key.toLowerCase().includes(q)
    let valueHit = false
    if (node === null || typeof node !== 'object') {
      valueHit = primitiveText(node).toLowerCase().includes(q)
    }
    if (keyHit || valueHit) {
      if (!pathHit.has(path)) {
        orderedPaths.push(path)
        pathHit.set(path, true)
      }
      markExpand(parts)
      if (parts.length === 0) expandPaths.add('root')
    }

    if (node !== null && typeof node === 'object') {
      const entries = Array.isArray(node)
        ? node.map((v, i) => [String(i), v] as const)
        : Object.entries(node as Record<string, unknown>)
      for (const [k, child] of entries) {
        walk(child, [...parts, k], k)
      }
    }
  }

  walk(value, [])
  return { orderedPaths, expandPaths, pathHit }
}

function JsonTree({
  value,
  name,
  path = 'root',
  depth = 0,
  pathHit,
  expandPaths,
  query,
  activePath,
  findTick
}: {
  value: unknown
  name?: string
  path?: string
  depth?: number
  pathHit: Map<string, boolean>
  expandPaths: Set<string>
  query: string
  activePath: string | null
  findTick: number
}) {
  const searching = query.trim().length > 0
  const shouldExpand =
    searching ? expandPaths.has(path) || depth < 1 : depth < 2
  const [open, setOpen] = useState(shouldExpand)
  const isObj = value !== null && typeof value === 'object'
  const isHit = Boolean(pathHit.get(path))
  const isActive = activePath === path
  const rowRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null)
  const entries = isObj
    ? Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    : []

  useEffect(() => {
    if (searching) setOpen(shouldExpand)
  }, [searching, shouldExpand, query])

  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [isActive, findTick])

  const rowClass = clsx(
    'flex items-center gap-1.5 py-px px-2 rounded font-mono text-[13px] leading-[1.75]',
    isActive && 'bg-warning/20 ring-1 ring-warning/45',
    !isActive && isHit && 'bg-warning/10',
    !isActive && !isHit && 'hover:bg-bg-elevated/80'
  )

  const keyClass = clsx(
    isActive || isHit ? 'text-warning font-medium' : 'text-[#7aa2ff]'
  )

  if (!isObj) {
    const display =
      typeof value === 'string' ? JSON.stringify(value) : primitiveText(value)
    return (
      <div
        ref={rowRef as RefObject<HTMLDivElement>}
        data-find-path={path}
        className={rowClass}
      >
        <span className="w-3" />
        {name != null && (
          <>
            <span className={keyClass}>
              {query.trim() ? (
                highlightString(
                  name,
                  query,
                  isActive ? 0 : -1,
                  0
                ).nodes
              ) : (
                name
              )}
            </span>
            <span className="text-text-secondary">: </span>
          </>
        )}
        <span className={valueColor(value)}>
          {query.trim()
            ? highlightString(display, query, isActive ? 0 : -1, 0).nodes
            : display}
        </span>
        <span className="text-[10px] text-text-muted border border-border-strong rounded-full px-1.5 py-px ml-1">
          {typePill(value)}
        </span>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        ref={rowRef as RefObject<HTMLButtonElement>}
        data-find-path={path}
        onClick={() => setOpen((o) => !o)}
        className={clsx(rowClass, 'w-full text-left')}
      >
        <span className="text-text-muted text-[10px] w-3 text-center">
          {open ? '▾' : '▸'}
        </span>
        {name != null && (
          <span className={keyClass}>
            {query.trim()
              ? highlightString(name, query, isActive ? 0 : -1, 0).nodes
              : name}
          </span>
        )}
        <span className="text-[10px] text-text-muted border border-border-strong rounded-full px-1.5 py-px ml-1">
          {typePill(value)}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-l border-border-subtle pl-1">
          {entries.map(([k, v]) => {
            const childPath = path === 'root' ? k : `${path}.${k}`
            return (
              <JsonTree
                key={childPath}
                name={k}
                path={childPath}
                value={v}
                depth={depth + 1}
                pathHit={pathHit}
                expandPaths={expandPaths}
                query={query}
                activePath={activePath}
                findTick={findTick}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function RawFindView({
  formatted,
  query,
  activeIndex,
  findTick,
  kind
}: {
  formatted: string
  query: string
  activeIndex: number
  findTick: number
  kind: FormatKind
}) {
  const preRef = useRef<HTMLPreElement>(null)
  const { nodes } = useMemo(
    () => highlightString(formatted, query, activeIndex, 0),
    [formatted, query, activeIndex]
  )

  useEffect(() => {
    if (!query.trim() || !preRef.current) return
    const el = preRef.current.querySelector(
      `[data-find-match="${activeIndex}"]`
    )
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [query, activeIndex, formatted, findTick])

  return (
    <pre
      ref={preRef}
      className="h-full overflow-auto font-mono text-[13px] leading-6 whitespace-pre-wrap text-text-primary"
    >
      {query.trim()
        ? nodes
        : kind === 'json'
          ? highlightJson(formatted)
          : highlightMarkup(formatted)}
    </pre>
  )
}

type ParseResult =
  | { empty: true }
  | {
      empty: false
      ok: true
      formatted: string
      parsed: unknown
      nodes: number
    }
  | { empty: false; ok: false; error: string }

export function JsonFormatter() {
  const saved = useTextToolSessionStore.getState().jsonFormatter
  const patchSession = useTextToolSessionStore((s) => s.patchJsonFormatter)

  const [input, setInput] = useState(saved.input)
  const [indent, setIndent] = useState<IndentMode>(saved.indent)
  const [mode, setMode] = useState<ViewMode>(saved.mode)
  const [kind, setKind] = useState<FormatKind>(saved.kind ?? 'json')
  const [sortKeys, setSortKeys] = useState(saved.sortKeys)
  const [findQuery, setFindQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [findTick, setFindTick] = useState(0)
  const [leftPct, setLeftPct] = useState(saved.leftPct)
  const findInputRef = useRef<HTMLInputElement>(null)

  useHandoffPayload(setInput)

  useEffect(() => {
    patchSession({ input, indent, mode, kind, sortKeys, leftPct })
  }, [input, indent, mode, kind, sortKeys, leftPct, patchSession])

  const result: ParseResult = useMemo(() => {
    if (!input.trim()) return { empty: true }
    const spaces = Number(indent)
    if (kind !== 'json') {
      const formatted =
        kind === 'html'
          ? prettyHtml(input, spaces || 2)
          : kind === 'css'
            ? prettyCss(input, spaces || 2)
            : kind === 'js'
              ? prettyJs(input, spaces || 2)
              : prettyLog(input)
      return {
        empty: false,
        ok: true as const,
        formatted,
        parsed: formatted,
        nodes: formatted.split(/\n/).length
      }
    }
    const parsed = parseJson(input)
    if (!parsed.ok) {
      return { empty: false, ok: false as const, error: parsed.error }
    }
    const value = sortKeys ? sortJsonKeys(parsed.value) : parsed.value
    return {
      empty: false,
      ok: true as const,
      formatted: formatJson(value, spaces, false),
      parsed: value,
      nodes: countNodes(value)
    }
  }, [input, indent, sortKeys, kind])

  const nodeMatches = useMemo(() => {
    if (result.empty || !result.ok) {
      return {
        orderedPaths: [] as string[],
        expandPaths: new Set<string>(),
        pathHit: new Map<string, boolean>()
      }
    }
    return collectNodeMatches(result.parsed, findQuery)
  }, [result, findQuery])

  const rawMatchCount = useMemo(() => {
    if (result.empty || !result.ok || !findQuery.trim()) return 0
    return countOccurrences(result.formatted, findQuery)
  }, [result, findQuery])

  // Browser-like: raw mode uses string occurrences; tree uses node paths
  const matchCount =
    mode === 'raw' ? rawMatchCount : nodeMatches.orderedPaths.length

  const activePath =
    mode === 'tree' && matchCount > 0
      ? nodeMatches.orderedPaths[
          ((activeIndex % matchCount) + matchCount) % matchCount
        ]
      : null

  const resultStamp =
    !result.empty && result.ok ? result.formatted : result.empty ? '' : 'err'

  // Reset to first match when query / mode / data changes
  useEffect(() => {
    setActiveIndex(0)
    setFindTick((t) => t + 1)
  }, [findQuery, mode, resultStamp])

  const goNext = useCallback(() => {
    if (matchCount === 0) return
    setActiveIndex((i) => (i + 1) % matchCount)
    setFindTick((t) => t + 1)
  }, [matchCount])

  const goPrev = useCallback(() => {
    if (matchCount === 0) return
    setActiveIndex((i) => (i - 1 + matchCount) % matchCount)
    setFindTick((t) => t + 1)
  }, [matchCount])

  const canCopy = !result.empty && result.ok

  const pasteFromClipboard = async () => {
    const text = await readClipboardText()
    if (text) setInput(text)
  }

  const findLabel =
    findQuery.trim() && matchCount > 0
      ? `${activeIndex + 1}/${matchCount}`
      : findQuery.trim()
        ? '0/0'
        : ''

  const loadSnapshot = (item: TextSnapshot) => {
    if (item.tool !== 'json-formatter') return
    setInput(item.input)
    setMode(item.mode)
    setIndent(item.indent)
    setSortKeys(item.sortKeys)
    setFindQuery('')
    setActiveIndex(0)
  }

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          <ToolSeg
            options={['json', 'html', 'css', 'js', 'log'] as const}
            value={kind}
            onChange={(k) => {
              setKind(k)
              if (k !== 'json') setMode('raw')
            }}
            labels={{
              json: 'JSON',
              html: 'HTML',
              css: 'CSS',
              js: 'JS',
              log: 'Logs'
            }}
          />
          {kind === 'json' && (
            <ToolSeg
              options={['tree', 'raw'] as const}
              value={mode}
              onChange={setMode}
              labels={{ tree: 'Tree', raw: 'Raw' }}
            />
          )}
          <ToolDivider />
          <ToolSeg
            options={['2', '4', '0'] as const}
            value={indent}
            onChange={setIndent}
            labels={{ '2': '2 spaces', '4': '4 spaces', '0': 'Minified' }}
          />
          <ToolDivider />
          {kind === 'json' && (
            <ToolToggle
              label="Sort keys"
              checked={sortKeys}
              onChange={setSortKeys}
            />
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <ToolFindBar
              value={findQuery}
              onChange={setFindQuery}
              disabled={result.empty || !result.ok}
              label={findLabel}
              onPrev={goPrev}
              onNext={goNext}
              matchCount={matchCount}
              inputRef={findInputRef}
            />
            <ToolButton variant="ghost" onClick={() => void pasteFromClipboard()}>
              Paste
            </ToolButton>
            <ToolButton
              variant="primary"
              disabled={!canCopy}
              onClick={() => {
                if (canCopy && !result.empty && result.ok) {
                  void navigator.clipboard.writeText(result.formatted)
                }
              }}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </ToolButton>
          </span>
        </ToolToolbar>
      </WorkspaceToolbar>

      <ToolWorkspaceExtras
        tool="json-formatter"
        canSave={Boolean(input.trim())}
        onSavePayload={() => ({
          tool: 'json-formatter' as const,
          input,
          mode,
          indent,
          sortKeys
        })}
        onLoad={loadSnapshot}
      />

      <SplitPane
        axis="x"
        value={leftPct}
        onChange={setLeftPct}
        min={MIN_LEFT_PCT}
        max={MAX_LEFT_PCT}
        className="flex-1 min-h-0"
      >
        <ToolPane
            className="h-full min-h-0"
            title="Input"
            actions={
              result.empty ? null : result.ok ? (
                <ToolBadge tone="ok">
                  {kind === 'json' ? 'Valid JSON' : 'Formatted'}
                </ToolBadge>
              ) : (
                <ToolBadge tone="err">Invalid</ToolBadge>
              )
            }
            bodyClassName="p-0 h-full flex flex-col"
          >
            <ToolMonoTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                kind === 'json'
                  ? 'Paste or type JSON here…'
                  : kind === 'log'
                    ? 'Paste logs here…'
                    : `Paste or type ${kind.toUpperCase()} here…`
              }
            />
            {!result.empty && !result.ok && (
              <div className="flex-shrink-0 border-t border-danger/25 bg-danger/10 px-4 py-2">
                <p className="text-[12px] leading-5 text-danger break-words">
                  {result.error}
                </p>
              </div>
            )}
          </ToolPane>
        <ToolPane
            className="h-full min-h-0"
            title={kind === 'json' && mode === 'tree' ? 'Tree' : 'Output'}
            actions={
              !result.empty && result.ok ? (
                <span className="text-[11.5px] text-text-secondary">
                  {result.nodes} nodes
                  {findQuery.trim()
                    ? ` · ${matchCount} match${matchCount === 1 ? '' : 'es'}`
                    : mode === 'tree'
                      ? ' · click to collapse'
                      : ''}
                </span>
              ) : null
            }
            bodyClassName="p-4 h-full"
          >
            {result.empty ? (
              <div className="h-full flex items-center justify-center text-[13px] text-text-muted">
                Output appears here once you paste something to format
              </div>
            ) : result.ok ? (
              mode === 'raw' || kind !== 'json' ? (
                <RawFindView
                  formatted={result.formatted}
                  query={findQuery}
                  activeIndex={
                    matchCount === 0
                      ? -1
                      : ((activeIndex % matchCount) + matchCount) % matchCount
                  }
                  findTick={findTick}
                  kind={kind}
                />
              ) : (
                <div className="h-full overflow-auto">
                  <JsonTree
                    name="root"
                    path="root"
                    value={result.parsed}
                    pathHit={nodeMatches.pathHit}
                    expandPaths={nodeMatches.expandPaths}
                    query={findQuery}
                    activePath={activePath}
                    findTick={findTick}
                  />
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-[13px] text-text-muted">
                Fix the input to preview output
              </div>
            )}
          </ToolPane>
      </SplitPane>
    </ToolFullscreenShell>
  )
}
