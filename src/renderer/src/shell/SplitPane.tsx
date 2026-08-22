import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode
} from 'react'

function stopSplitDrag() {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.body.classList.remove(
    'is-split-dragging',
    'is-split-dragging-x',
    'is-split-dragging-y'
  )
}

/**
 * Shared drag-resize split. Each instance is independent — nest them so
 * every pane boundary (not a whole column/row of panes) can move on its own.
 */
export function SplitPane({
  axis,
  value,
  onChange,
  min = 16,
  max = 84,
  className = '',
  children
}: {
  axis: 'x' | 'y'
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  className?: string
  children: [ReactNode, ReactNode]
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const axisRef = useRef(axis)
  const minRef = useRef(min)
  const maxRef = useRef(max)
  const onChangeRef = useRef(onChange)
  const [first, second] = children

  axisRef.current = axis
  minRef.current = min
  maxRef.current = max
  onChangeRef.current = onChange

  const apply = useCallback((client: number) => {
    const el = rootRef.current
    if (!el) return
    const currentAxis = axisRef.current
    const rect = el.getBoundingClientRect()
    const span = currentAxis === 'x' ? rect.width : rect.height
    if (span <= 0) return
    const origin = currentAxis === 'x' ? rect.left : rect.top
    const pct = ((client - origin) / span) * 100
    onChangeRef.current(
      Math.min(maxRef.current, Math.max(minRef.current, pct))
    )
  }, [])

  useEffect(() => {
    // Recover if a previous drag left the resize cursor on <body>.
    stopSplitDrag()

    const move = (e: PointerEvent) => {
      if (!drag.current) return
      e.preventDefault()
      apply(axisRef.current === 'x' ? e.clientX : e.clientY)
    }
    const up = () => {
      if (!drag.current) return
      drag.current = false
      stopSplitDrag()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
      drag.current = false
      stopSplitDrag()
    }
  }, [apply])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    drag.current = true
    document.body.style.userSelect = 'none'
    document.body.classList.add(
      'is-split-dragging',
      axis === 'x' ? 'is-split-dragging-x' : 'is-split-dragging-y'
    )
    apply(axis === 'x' ? e.clientX : e.clientY)
  }

  return (
    <div
      ref={rootRef}
      className={`flex min-h-0 min-w-0 overflow-hidden ${
        axis === 'x' ? 'flex-row' : 'flex-col'
      } ${className}`}
    >
      <div
        className={
          axis === 'x'
            ? 'h-full min-h-0 min-w-0 overflow-hidden'
            : 'w-full min-h-0 min-w-0 overflow-hidden'
        }
        style={
          axis === 'x' ? { width: `${value}%` } : { height: `${value}%` }
        }
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(value)}
        title="Drag to resize this pane"
        onPointerDown={onPointerDown}
        className={
          axis === 'x'
            ? 'w-2.5 flex-shrink-0 cursor-col-resize flex items-center justify-center group relative touch-none'
            : 'h-2.5 flex-shrink-0 cursor-row-resize flex items-center justify-center group relative touch-none'
        }
      >
        <div
          className={
            axis === 'x'
              ? 'w-1 h-8 rounded-full bg-border-strong group-hover:bg-accent group-active:bg-accent transition-colors'
              : 'h-1 w-8 rounded-full bg-border-strong group-hover:bg-accent group-active:bg-accent transition-colors'
          }
        />
      </div>
      <div
        className={
          axis === 'x'
            ? 'h-full min-h-0 min-w-0 flex-1 overflow-hidden'
            : 'w-full min-h-0 min-w-0 flex-1 overflow-hidden'
        }
      >
        {second}
      </div>
    </div>
  )
}
