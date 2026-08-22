import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { Change } from 'diff'
import type { DiffResult } from 'json-diff-kit'
import {
  ArrowLeftRight,
  Eraser,
  GitCompareArrows
} from 'lucide-react'
import { clsx } from 'clsx'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import { SplitPane } from '../../../shell/SplitPane'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import {
  ToolBadge,
  ToolButton,
  ToolDivider,
  ToolPane,
  ToolSeg,
  ToolToggle,
  ToolToolbar
} from './toolUi'
import {
  DiffNavControls,
  ToolFindBar,
  ToolMonoTextarea,
  readClipboardText
} from './toolChrome'
import {
  escapeRegExp,
  formatJson,
  isJsonEqual,
  parseJson,
  sortJsonKeys
} from './jsonUtils'
import {
  ToolFullscreenShell,
  ToolWorkspaceExtras
} from './ToolWorkspaceExtras'
import type { TextSnapshot } from '../../../../../shared/types'

type Side = 'left' | 'right'
type Mode = 'semantic' | 'line'

type SemanticRun = {
  kind: 'semantic'
  diff: readonly [DiffResult[], DiffResult[]]
  identical: boolean
  leftPretty: string
  rightPretty: string
}

type LineRun = {
  kind: 'line'
  parts: Change[]
  identical: boolean
}

type DiffRun = SemanticRun | LineRun

const MIN_LEFT_PCT = 22
const MAX_LEFT_PCT = 78
const MIN_SOURCES_PCT = 18
const MAX_SOURCES_PCT = 70
const VIEWER_SCROLL_ID = 'portpilot-json-diff-scroll'
const LINE_DIFF_ROOT_ID = 'portpilot-json-diff-line'
const FIND_MARK_CLASS = 'portpilot-find-hit'
const FIND_MARK_ACTIVE = 'is-active'

const VIEWER_BG = {
  add: 'rgb(34 197 94 / 0.18)',
  remove: 'rgb(239 68 68 / 0.18)',
  modify: 'rgb(245 158 11 / 0.2)'
}

function collectMatches(
  text: string,
  query: string
): { start: number; end: number }[] {
  const q = query.trim()
  if (!q || !text) return []
  const re = new RegExp(escapeRegExp(q), 'gi')
  const out: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length })
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

function clearFindMarks(root: ParentNode): void {
  root.querySelectorAll(`mark.${FIND_MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark)
    parent.normalize()
  })
}

/** Wrap case-insensitive matches in mark elements; returns marks in document order. */
function applyFindMarks(root: HTMLElement, query: string): HTMLElement[] {
  clearFindMarks(root)
  const q = query.trim()
  if (!q) return []

  const textNodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.nodeValue
    if (!text || !text.trim()) continue
    // Skip line-number cells
    const el = (node as Text).parentElement
    if (el?.closest('td.line-number')) continue
    textNodes.push(node as Text)
  }

  const marks: HTMLElement[] = []
  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? ''
    const parts = collectMatches(text, q)
    if (!parts.length) continue

    const nodeMarks: HTMLElement[] = []
    // Split from the end so earlier offsets stay valid
    for (let i = parts.length - 1; i >= 0; i--) {
      const { start, end } = parts[i]
      if (end > (textNode.nodeValue?.length ?? 0)) continue
      try {
        const range = document.createRange()
        range.setStart(textNode, start)
        range.setEnd(textNode, end)
        const mark = document.createElement('mark')
        mark.className = FIND_MARK_CLASS
        range.surroundContents(mark)
        nodeMarks.unshift(mark)
      } catch {
        // Range may fail if the node was already split; ignore that hit
      }
    }
    marks.push(...nodeMarks)
  }
  return marks
}

function activateFindMark(marks: HTMLElement[], index: number): void {
  if (!marks.length) return
  const idx = ((index % marks.length) + marks.length) % marks.length
  marks.forEach((m, i) => {
    m.classList.toggle(FIND_MARK_ACTIVE, i === idx)
  })
  marks[idx]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/** Row indices in the Viewer table that are not equal on either side. */
function semanticDiffIndices(
  diff: readonly [DiffResult[], DiffResult[]]
): number[] {
  const [left, right] = diff
  const len = Math.max(left.length, right.length)
  const out: number[] = []
  for (let i = 0; i < len; i++) {
    const lt = left[i]?.type
    const rt = right[i]?.type
    if ((lt && lt !== 'equal') || (rt && rt !== 'equal')) out.push(i)
  }
  return out
}

function lineDiffIndices(parts: Change[]): number[] {
  const indices: number[] = []
  let row = 0
  for (const p of parts) {
    const lines = p.value.split('\n')
    if (lines.length && lines[lines.length - 1] === '') lines.pop()
    for (let j = 0; j < lines.length; j++) {
      if (p.added || p.removed) indices.push(row)
      row++
    }
  }
  return indices
}

function LineDiffView({
  parts,
  activeRow
}: {
  parts: Change[]
  activeRow: number | null
}): ReactNode {
  let row = 0
  return (
    <pre
      id={LINE_DIFF_ROOT_ID}
      className="h-full overflow-auto p-3 font-mono text-[13px] leading-6 whitespace-pre-wrap text-text-primary m-0"
    >
      {parts.map((p, i) => {
        const lines = p.value.split('\n')
        if (lines.length && lines[lines.length - 1] === '') lines.pop()
        return lines.map((line, j) => {
          const thisRow = row++
          return (
            <div
              key={`${i}-${j}`}
              data-diff-row={String(thisRow)}
              className={clsx(
                'rounded-sm px-1 -mx-1 min-h-[1.5rem]',
                p.added && 'bg-success/25',
                p.removed && 'bg-danger/25',
                activeRow === thisRow && 'ring-1 ring-warning/70'
              )}
            >
              <span
                className={clsx(
                  p.added && 'text-success',
                  p.removed && 'text-danger'
                )}
              >
                {p.added ? '+ ' : p.removed ? '− ' : '  '}
                {line || ' '}
              </span>
            </div>
          )
        })
      })}
    </pre>
  )
}

export function JsonDiff({
  leadingControls
}: {
  leadingControls?: ReactNode
} = {}) {
  const saved = useTextToolSessionStore.getState().jsonDiff
  const patchSession = useTextToolSessionStore((s) => s.patchJsonDiff)

  const [leftRaw, setLeftRaw] = useState(saved.leftRaw)
  const [rightRaw, setRightRaw] = useState(saved.rightRaw)
  const [ignoreKeyOrder, setIgnoreKeyOrder] = useState(saved.ignoreKeyOrder)
  const [mode, setMode] = useState<Mode>(saved.mode)
  const [run, setRun] = useState<DiffRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSources, setShowSources] = useState(saved.showSources)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)
  const [findTick, setFindTick] = useState(0)
  const [diffNavIndex, setDiffNavIndex] = useState(0)
  const [leftPct, setLeftPct] = useState(saved.leftPct)
  const [sourcesPct, setSourcesPct] = useState(saved.sourcesPct)
  const [diffReady, setDiffReady] = useState(false)
  const differRef = useRef<InstanceType<
    typeof import('json-diff-kit').Differ
  > | null>(null)
  const diffLibRef = useRef<typeof import('diff') | null>(null)
  const [Viewer, setViewer] = useState<
    typeof import('json-diff-kit').Viewer | null
  >(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [kit, diff] = await Promise.all([
        import('json-diff-kit'),
        import('diff'),
        import('json-diff-kit/dist/viewer.css'),
        import('./jsonDiffViewer.css')
      ])
      if (cancelled) return
      differRef.current = new kit.Differ({
        detectCircular: true,
        showModifications: true,
        arrayDiffMethod: 'lcs'
      })
      diffLibRef.current = diff
      setViewer(() => kit.Viewer)
      setDiffReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    patchSession({
      leftRaw,
      rightRaw,
      ignoreKeyOrder,
      mode,
      showSources,
      leftPct,
      sourcesPct
    })
  }, [
    leftRaw,
    rightRaw,
    ignoreKeyOrder,
    mode,
    showSources,
    leftPct,
    sourcesPct,
    patchSession
  ])

  const bothEmpty = !leftRaw.trim() && !rightRaw.trim()

  const diffIndices = useMemo(() => {
    if (!run || run.identical) return [] as number[]
    if (run.kind === 'semantic') return semanticDiffIndices(run.diff)
    return lineDiffIndices(run.parts)
  }, [run])

  const diffCount = diffIndices.length
  const activeDiffRow =
    diffCount === 0
      ? null
      : diffIndices[((diffNavIndex % diffCount) + diffCount) % diffCount]
  const diffLabel =
    diffCount > 0
      ? `${((diffNavIndex % diffCount) + diffCount) % diffCount + 1}/${diffCount}`
      : ''

  const sourceFindMatches = useMemo(() => {
    if (!findQuery.trim()) {
      return [] as { side: Side; start: number; end: number }[]
    }
    return [
      ...collectMatches(leftRaw, findQuery).map((m) => ({
        side: 'left' as const,
        ...m
      })),
      ...collectMatches(rightRaw, findQuery).map((m) => ({
        side: 'right' as const,
        ...m
      }))
    ]
  }, [findQuery, leftRaw, rightRaw])

  const resultFindText = useMemo(() => {
    if (!run) return ''
    if (run.kind === 'semantic') {
      return `${run.leftPretty}\n${run.rightPretty}`
    }
    return run.parts.map((p) => p.value).join('')
  }, [run])

  const resultFindCount = useMemo(
    () => collectMatches(resultFindText, findQuery).length,
    [resultFindText, findQuery]
  )

  // Prefer highlighting in the result surface after a diff; otherwise sources.
  const findInResult = Boolean(run && findQuery.trim())
  const findCount = findInResult ? resultFindCount : sourceFindMatches.length
  const activeSourceFind =
    !findInResult && findCount > 0
      ? sourceFindMatches[((findIndex % findCount) + findCount) % findCount]
      : null
  const findLabel =
    findQuery.trim() && findCount > 0
      ? `${((findIndex % findCount) + findCount) % findCount + 1}/${findCount}`
      : findQuery.trim()
        ? '0/0'
        : ''

  const findMarksRef = useRef<HTMLElement[]>([])

  useEffect(() => {
    setFindIndex(0)
    setFindTick((t) => t + 1)
  }, [findQuery, leftRaw, rightRaw, run])

  useEffect(() => {
    setDiffNavIndex(0)
  }, [run])

  // Highlight matches in the Viewer / line view
  useEffect(() => {
    if (!findInResult || !run) {
      const viewer = document.getElementById(VIEWER_SCROLL_ID)
      const lineRoot = document.getElementById(LINE_DIFF_ROOT_ID)
      if (viewer) clearFindMarks(viewer)
      if (lineRoot) clearFindMarks(lineRoot)
      findMarksRef.current = []
      return
    }

    let cancelled = false
    const raf = requestAnimationFrame(() => {
      if (cancelled) return
      const root =
        run.kind === 'semantic'
          ? document.getElementById(VIEWER_SCROLL_ID)
          : document.getElementById(LINE_DIFF_ROOT_ID)
      if (!root) return
      const marks = applyFindMarks(root, findQuery)
      findMarksRef.current = marks
      activateFindMark(marks, findIndex)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [findInResult, run, findQuery, findIndex, findTick])

  // Select match in source textareas when searching before a diff
  useEffect(() => {
    if (!activeSourceFind) return
    if (!showSources) {
      setShowSources(true)
      return
    }
    const id =
      activeSourceFind.side === 'left' ? 'json-diff-left' : 'json-diff-right'
    const timer = window.setTimeout(() => {
      const el = document.getElementById(id) as HTMLTextAreaElement | null
      if (!el) return
      el.focus()
      el.setSelectionRange(activeSourceFind.start, activeSourceFind.end)
      const line = el.value.slice(0, activeSourceFind.start).split('\n').length
      el.scrollTop = Math.max(0, (line - 4) * 24)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeSourceFind, showSources, findIndex, findTick])

  // Scroll Viewer / line view to active difference
  useEffect(() => {
    if (activeDiffRow == null || !run) return

    if (run.kind === 'line') {
      const el = document.querySelector(`[data-diff-row="${activeDiffRow}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    const scroller = document.getElementById(VIEWER_SCROLL_ID)
    if (!scroller) return
    scroller
      .querySelectorAll('tr.portpilot-diff-active')
      .forEach((tr) => tr.classList.remove('portpilot-diff-active'))

    // With hideUnchangedLines, navigate by ordinal among changed DOM rows
    const changedRows = Array.from(
      scroller.querySelectorAll<HTMLTableRowElement>('tbody tr')
    ).filter((tr) =>
      tr.querySelector('.line-modify, .line-add, .line-remove')
    )
    const ordinal =
      ((diffNavIndex % changedRows.length) + changedRows.length) %
      Math.max(changedRows.length, 1)
    const target = changedRows[ordinal]
    if (target) {
      target.classList.add('portpilot-diff-active')
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeDiffRow, run, diffNavIndex])

  const goFind = (dir: 1 | -1) => {
    if (findCount === 0) return
    setFindIndex((i) => (i + dir + findCount) % findCount)
    setFindTick((t) => t + 1)
    if (!findInResult && !showSources) setShowSources(true)
  }

  const goDiff = (dir: 1 | -1) => {
    if (diffCount === 0) return
    setDiffNavIndex((i) => (i + dir + diffCount) % diffCount)
  }

  const findDifference = () => {
    setError(null)
    if (bothEmpty) return
    if (!diffReady || !differRef.current || !diffLibRef.current) {
      setError('Diff engine is still loading…')
      return
    }

    if (mode === 'line') {
      const parts = diffLibRef.current.diffLines(leftRaw, rightRaw)
      setRun({
        kind: 'line',
        parts,
        identical: leftRaw === rightRaw
      })
      setShowSources(false)
      setDiffNavIndex(0)
      return
    }

    const leftSrc = leftRaw.trim() ? leftRaw : '{}'
    const rightSrc = rightRaw.trim() ? rightRaw : '{}'
    const lp = parseJson(leftSrc)
    const rp = parseJson(rightSrc)
    if (!lp.ok) {
      setRun(null)
      setError(`Original: ${lp.error}`)
      return
    }
    if (!rp.ok) {
      setRun(null)
      setError(`Changed: ${rp.error}`)
      return
    }

    let leftValue = lp.value
    let rightValue = rp.value
    if (ignoreKeyOrder) {
      leftValue = sortJsonKeys(leftValue)
      rightValue = sortJsonKeys(rightValue)
    }

    const leftPretty = formatJson(leftValue, 2, false)
    const rightPretty = formatJson(rightValue, 2, false)
    setLeftRaw(leftPretty)
    setRightRaw(rightPretty)

    setRun({
      kind: 'semantic',
      diff: differRef.current.diff(leftValue, rightValue),
      identical: isJsonEqual(leftValue, rightValue),
      leftPretty,
      rightPretty
    })
    setShowSources(false)
    setDiffNavIndex(0)
  }

  const clearAll = () => {
    setLeftRaw('')
    setRightRaw('')
    setRun(null)
    setError(null)
    setFindQuery('')
    setFindIndex(0)
    setDiffNavIndex(0)
    setShowSources(true)
  }

  const pasteInto = async (side: Side) => {
    const text = await readClipboardText()
    if (!text) return
    if (side === 'left') setLeftRaw(text)
    else setRightRaw(text)
    setRun(null)
    setError(null)
    setShowSources(true)
  }

  const onEdit = (side: Side, value: string) => {
    if (side === 'left') setLeftRaw(value)
    else setRightRaw(value)
    if (run) {
      setRun(null)
      setError(null)
    }
  }

  const stale =
    !!run &&
    run.kind === 'semantic' &&
    (run.leftPretty !== leftRaw || run.rightPretty !== rightRaw)

  const renderSourcePane = (side: Side) => {
    const raw = side === 'left' ? leftRaw : rightRaw
    const title = side === 'left' ? 'Original' : 'Changed'
    const id = side === 'left' ? 'json-diff-left' : 'json-diff-right'
    return (
      <ToolPane
        className="h-full min-h-0"
        title={title}
        actions={
          <ToolButton variant="ghost" onClick={() => void pasteInto(side)}>
            Paste
          </ToolButton>
        }
        bodyClassName="p-0 overflow-hidden flex flex-col h-full min-h-0"
      >
        <ToolMonoTextarea
          id={id}
          value={raw}
          onChange={(e) => onEdit(side, e.target.value)}
          placeholder={
            side === 'left'
              ? 'Paste or type original JSON…'
              : 'Paste or type changed JSON…'
          }
        />
      </ToolPane>
    )
  }

  const loadSnapshot = (item: TextSnapshot) => {
    if (item.tool !== 'json-diff') return
    setLeftRaw(item.left)
    setRightRaw(item.right)
    setMode(item.mode)
    setIgnoreKeyOrder(item.ignoreKeyOrder)
    setRun(null)
    setError(null)
    setShowSources(true)
    setFindQuery('')
    setFindIndex(0)
  }

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          {leadingControls}
          {leadingControls ? <ToolDivider /> : null}
          <ToolSeg
            options={['semantic', 'line'] as const}
            value={mode}
            onChange={(m) => {
              setMode(m)
              setRun(null)
              setError(null)
              setShowSources(true)
            }}
            labels={{ semantic: 'Inline', line: 'Line-by-line' }}
          />
          <ToolDivider />
          {mode === 'semantic' && (
            <ToolToggle
              label="Ignore key order"
              checked={ignoreKeyOrder}
              onChange={(v) => {
                setIgnoreKeyOrder(v)
                setRun(null)
                setError(null)
              }}
            />
          )}
          <ToolButton
            variant="ghost"
            onClick={() => {
              setLeftRaw(rightRaw)
              setRightRaw(leftRaw)
              setRun(null)
              setError(null)
              setShowSources(true)
            }}
            disabled={bothEmpty}
            title="Swap sides"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Swap
          </ToolButton>
          {error && <ToolBadge tone="err">Invalid JSON</ToolBadge>}
          {run?.identical && <ToolBadge tone="ok">Identical</ToolBadge>}
          {run && !run.identical && diffCount > 0 && (
            <DiffNavControls
              label={diffLabel}
              onPrev={() => goDiff(-1)}
              onNext={() => goDiff(1)}
              prevTitle="Previous difference"
              nextTitle="Next difference"
            />
          )}
          {stale && <ToolBadge tone="warn">Edited — run again</ToolBadge>}

          {/* Right cluster: Search → Clear → Edit sources → Find Difference */}
          <span className="ml-auto flex items-center gap-1.5">
            <ToolFindBar
              value={findQuery}
              onChange={setFindQuery}
              disabled={bothEmpty}
              label={findLabel}
              onPrev={() => goFind(-1)}
              onNext={() => goFind(1)}
              matchCount={findCount}
              widthClass="w-56"
            />
            <ToolButton
              variant="ghost"
              onClick={clearAll}
              disabled={bothEmpty && !findQuery && !run}
              title="Clear both sides"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </ToolButton>
            {run && (
              <ToolButton
                variant="ghost"
                onClick={() => setShowSources(!showSources)}
              >
                {showSources ? 'Hide sources' : 'Edit sources'}
              </ToolButton>
            )}
            <ToolButton
              variant="primary"
              onClick={findDifference}
              disabled={bothEmpty}
              title="Compare both sides"
            >
              <GitCompareArrows className="w-3.5 h-3.5" />
              Find Difference
            </ToolButton>
          </span>
        </ToolToolbar>
      </WorkspaceToolbar>

      <ToolWorkspaceExtras
        tool="json-diff"
        canSave={!bothEmpty}
        onSavePayload={() => ({
          tool: 'json-diff' as const,
          left: leftRaw,
          right: rightRaw,
          mode,
          ignoreKeyOrder
        })}
        onLoad={loadSnapshot}
      />

      {error && (
        <p className="flex-shrink-0 text-[12px] text-danger px-1">{error}</p>
      )}

      {(() => {
        const sources = (
          <SplitPane
            axis="x"
            value={leftPct}
            onChange={setLeftPct}
            min={MIN_LEFT_PCT}
            max={MAX_LEFT_PCT}
            className="h-full"
          >
            {renderSourcePane('left')}
            {renderSourcePane('right')}
          </SplitPane>
        )
        const resultPane = run ? (
          <div className="h-full min-h-0 flex flex-col">
            {run.kind === 'semantic' ? (
              <div
                id={VIEWER_SCROLL_ID}
                className="portpilot-json-diff flex-1 min-h-0"
              >
                {Viewer ? (
                  <Viewer
                    diff={run.diff}
                    indent={2}
                    lineNumbers
                    highlightInlineDiff
                    inlineDiffOptions={{ mode: 'char' }}
                    bgColour={VIEWER_BG}
                  />
                ) : (
                  <p className="p-3 text-[12.5px] text-text-muted">
                    Loading diff viewer…
                  </p>
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 rounded-xl border border-border-subtle bg-bg-card overflow-hidden">
                <LineDiffView parts={run.parts} activeRow={activeDiffRow} />
              </div>
            )}
          </div>
        ) : null

        if (showSources && run && resultPane) {
          return (
            <SplitPane
              axis="y"
              value={sourcesPct}
              onChange={setSourcesPct}
              min={MIN_SOURCES_PCT}
              max={MAX_SOURCES_PCT}
              className="flex-1 min-h-0"
            >
              {sources}
              {resultPane}
            </SplitPane>
          )
        }
        if (showSources) {
          return <div className="flex-1 min-h-0">{sources}</div>
        }
        if (resultPane) {
          return <div className="flex-1 min-h-0">{resultPane}</div>
        }
        return (
          <div className="flex-1 flex items-center justify-center text-[13px] text-text-muted">
            Paste JSON on both sides, then Find Difference
          </div>
        )
      })()}

      {run && (
        <p className="flex-shrink-0 text-[11px] text-text-muted text-center">
          <span className="inline-flex items-center gap-3">
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-danger/40 mr-1 align-middle" />
              removed
            </span>
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-success/40 mr-1 align-middle" />
              added
            </span>
            <span>
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-warning/35 mr-1 align-middle" />
              changed
            </span>
          </span>
        </p>
      )}
    </ToolFullscreenShell>
  )
}
