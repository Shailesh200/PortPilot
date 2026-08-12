import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent
} from 'react'
import * as Diff from 'diff'
import { ChevronDown, ChevronUp, Eraser } from 'lucide-react'
import { clsx } from 'clsx'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import type { TextSnapshot } from '../../../../../shared/types'
import {
  ToolBadge,
  ToolButton,
  ToolPane,
  ToolToggle,
  ToolToolbar
} from './toolUi'
import {
  ToolFullscreenShell,
  ToolWorkspaceExtras
} from './ToolWorkspaceExtras'

type CharPart = Diff.Change & { idx: number }

function sideParts(parts: CharPart[], side: 'left' | 'right'): CharPart[] {
  return parts.filter((part) => {
    if (side === 'left' && part.added) return false
    if (side === 'right' && part.removed) return false
    return true
  })
}

function HighlightLayer({
  parts,
  side,
  activePartIndex
}: {
  parts: CharPart[]
  side: 'left' | 'right'
  activePartIndex: number | null
}): ReactNode {
  const visible = sideParts(parts, side)
  return (
    <>
      {visible.map((part) => {
        const isChange =
          (side === 'left' && part.removed) || (side === 'right' && part.added)
        const isActive = isChange && activePartIndex === part.idx
        return (
          <span
            key={`${side}-${part.idx}`}
            data-change-idx={isChange ? String(part.idx) : undefined}
            className={clsx(
              'rounded-sm',
              side === 'left' && part.removed && 'bg-danger/35 text-danger',
              side === 'right' && part.added && 'bg-success/35 text-success',
              !isChange && 'text-text-primary',
              isActive &&
                'ring-1 ring-warning/80 ring-offset-1 ring-offset-bg-card'
            )}
          >
            {part.value}
          </span>
        )
      })}
    </>
  )
}

function InlineDiffEditor({
  value,
  onChange,
  side,
  parts,
  activePartIndex,
  navTick,
  placeholder
}: {
  value: string
  onChange: (v: string) => void
  side: 'left' | 'right'
  parts: CharPart[]
  activePartIndex: number | null
  navTick: number
  placeholder: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const applyLayerScroll = (top: number) => {
    if (!layerRef.current) return
    layerRef.current.style.transform = `translateY(${-top}px)`
  }

  const syncScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    applyLayerScroll(e.currentTarget.scrollTop)
  }

  useEffect(() => {
    const root = rootRef.current
    const layer = layerRef.current
    const area = areaRef.current
    if (!root || !layer || !area) return

    // Wrapped text never needs horizontal pan — keep origin flush left.
    area.scrollLeft = 0
    applyLayerScroll(area.scrollTop)

    if (activePartIndex == null) return
    const mark = layer.querySelector(`[data-change-idx="${activePartIndex}"]`)
    if (!(mark instanceof HTMLElement)) return

    const id = requestAnimationFrame(() => {
      const rootRect = root.getBoundingClientRect()
      const markRect = mark.getBoundingClientRect()
      const offsetTop = markRect.top - rootRect.top + area.scrollTop
      const nextTop = Math.max(
        0,
        offsetTop - root.clientHeight / 2 + markRect.height / 2
      )
      area.scrollTop = nextTop
      area.scrollLeft = 0
      applyLayerScroll(nextTop)
    })
    return () => cancelAnimationFrame(id)
  }, [activePartIndex, navTick])

  return (
    <div ref={rootRef} className="relative flex-1 min-h-0 overflow-hidden">
      <div
        ref={layerRef}
        aria-hidden
        className="absolute top-0 left-0 right-0 p-4 font-mono text-[13px] leading-6 whitespace-pre-wrap break-words pointer-events-none will-change-transform"
      >
        {value ? (
          <HighlightLayer
            parts={parts}
            side={side}
            activePartIndex={activePartIndex}
          />
        ) : (
          <span className="text-text-muted">{placeholder}</span>
        )}
        {'\n'}
      </div>
      <textarea
        ref={areaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        placeholder={placeholder}
        className="absolute inset-0 w-full h-full resize-none bg-transparent p-4 font-mono text-[13px] leading-6 text-transparent caret-text-primary placeholder:text-transparent focus:outline-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words"
      />
    </div>
  )
}

export function TextDiff() {
  const saved = useTextToolSessionStore.getState().textDiff
  const patchSession = useTextToolSessionStore((s) => s.patchTextDiff)

  const [left, setLeft] = useState(saved.left)
  const [right, setRight] = useState(saved.right)
  const [split, setSplit] = useState(saved.split)
  const [navIndex, setNavIndex] = useState(0)
  const [navTick, setNavTick] = useState(0)

  useEffect(() => {
    patchSession({ left, right, split })
  }, [left, right, split, patchSession])

  const parts = useMemo<CharPart[]>(
    () => Diff.diffChars(left, right).map((p, idx) => ({ ...p, idx })),
    [left, right]
  )

  const changeIndices = useMemo(
    () => parts.filter((p) => p.added || p.removed).map((p) => p.idx),
    [parts]
  )

  const changeCount = changeIndices.length
  const activePartIndex =
    changeCount === 0
      ? null
      : changeIndices[((navIndex % changeCount) + changeCount) % changeCount]
  const changeLabel =
    changeCount > 0
      ? `${((navIndex % changeCount) + changeCount) % changeCount + 1}/${changeCount}`
      : ''

  const addedChars = useMemo(
    () =>
      parts
        .filter((p) => p.added)
        .reduce((n, p) => n + (p.value?.length ?? 0), 0),
    [parts]
  )
  const removedChars = useMemo(
    () =>
      parts
        .filter((p) => p.removed)
        .reduce((n, p) => n + (p.value?.length ?? 0), 0),
    [parts]
  )

  useEffect(() => {
    setNavIndex(0)
  }, [left, right])

  const goChange = (dir: 1 | -1) => {
    if (changeCount === 0) return
    setNavIndex((i) => (i + dir + changeCount) % changeCount)
    setNavTick((t) => t + 1)
  }

  const clearAll = () => {
    setLeft('')
    setRight('')
    setNavIndex(0)
  }

  const identical = left === right
  const bothEmpty = !left.trim() && !right.trim()

  const loadSnapshot = (item: TextSnapshot) => {
    if (item.tool !== 'text-diff') return
    setLeft(item.left)
    setRight(item.right)
    setSplit(item.split)
  }

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          <ToolToggle
            label="Split view inputs"
            checked={split}
            onChange={setSplit}
          />
          {identical && !bothEmpty && (
            <ToolBadge tone="ok">Identical</ToolBadge>
          )}
          {!identical && changeCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ToolBadge tone="warn">{changeLabel} changed</ToolBadge>
              <button
                type="button"
                title="Previous change"
                onClick={() => goChange(-1)}
                className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Next change"
                onClick={() => goChange(1)}
                className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {removedChars > 0 && (
              <ToolBadge tone="err">{removedChars} removed</ToolBadge>
            )}
            {addedChars > 0 && (
              <ToolBadge tone="ok">{addedChars} added</ToolBadge>
            )}
            <ToolButton
              variant="ghost"
              onClick={clearAll}
              disabled={bothEmpty}
              title="Clear both sides"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </ToolButton>
          </span>
        </ToolToolbar>
      </WorkspaceToolbar>

      <ToolWorkspaceExtras
        tool="text-diff"
        canSave={!bothEmpty}
        onSavePayload={() => ({
          tool: 'text-diff' as const,
          left,
          right,
          split
        })}
        onLoad={loadSnapshot}
      />

      <div
        className={clsx(
          'flex-1 min-h-0 grid gap-2',
          split ? 'lg:grid-cols-2' : 'grid-cols-1'
        )}
      >
        <ToolPane
          title="Original"
          className="min-h-0 h-full"
          badge={
            removedChars > 0 ? (
              <ToolBadge tone="err">{removedChars} removed</ToolBadge>
            ) : null
          }
          bodyClassName="p-0 h-full flex flex-col overflow-hidden"
        >
          <InlineDiffEditor
            value={left}
            onChange={setLeft}
            side="left"
            parts={parts}
            activePartIndex={activePartIndex}
            navTick={navTick}
            placeholder="Original text…"
          />
        </ToolPane>

        <ToolPane
          title="Changed"
          className="min-h-0 h-full"
          badge={
            addedChars > 0 ? (
              <ToolBadge tone="ok">{addedChars} added</ToolBadge>
            ) : null
          }
          bodyClassName="p-0 h-full flex flex-col overflow-hidden"
        >
          <InlineDiffEditor
            value={right}
            onChange={setRight}
            side="right"
            parts={parts}
            activePartIndex={activePartIndex}
            navTick={navTick}
            placeholder="Changed text…"
          />
        </ToolPane>
      </div>

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
            active change
          </span>
        </span>
      </p>
    </ToolFullscreenShell>
  )
}
