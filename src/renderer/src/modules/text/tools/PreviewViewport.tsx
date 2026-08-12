import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { clsx } from 'clsx'
import { Minus, Plus, Scan } from 'lucide-react'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

function clampZoom(n: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n * 100) / 100))
}

function formatZoom(n: number): string {
  return `${Math.round(n * 100)}%`
}

/**
 * Zoomable document preview chrome. Defaults to fit-to-width.
 * (Workspace-level fullscreen is handled by ToolImmersiveButton.)
 */
export function PreviewViewport({
  children,
  className,
  contentKey,
  loading = false
}: {
  children: ReactNode
  className?: string
  /** Change when the underlying document changes so fit remeasures */
  contentKey?: string
  loading?: boolean
}) {
  const [fit, setFit] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [fitScale, setFitScale] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const displayZoom = fit ? fitScale : zoom
  const scale = fit ? fitScale : zoom

  const measureFit = useCallback(() => {
    const vp = viewportRef.current
    const content = contentRef.current
    if (!vp || !content) return

    const prevZoom = content.style.zoom
    content.style.zoom = '1'
    const contentWidth = Math.max(
      content.scrollWidth,
      content.offsetWidth,
      1
    )
    content.style.zoom = prevZoom

    const available = Math.max(40, vp.clientWidth - 16)
    setFitScale(clampZoom(available / contentWidth))
  }, [])

  useEffect(() => {
    setFit(true)
  }, [contentKey])

  useEffect(() => {
    measureFit()
    const vp = viewportRef.current
    const content = contentRef.current
    if (!vp) return
    const ro = new ResizeObserver(() => measureFit())
    ro.observe(vp)
    if (content) ro.observe(content)
    return () => ro.disconnect()
  }, [measureFit, contentKey])

  useEffect(() => {
    const ids = [
      window.setTimeout(measureFit, 50),
      window.setTimeout(measureFit, 200),
      window.setTimeout(measureFit, 500),
      window.setTimeout(measureFit, 1000)
    ]
    return () => ids.forEach(clearTimeout)
  }, [contentKey, loading, measureFit])

  const zoomOut = () => {
    setFit(false)
    setZoom((z) => clampZoom((fit ? fitScale : z) - ZOOM_STEP))
  }

  const zoomIn = () => {
    setFit(false)
    setZoom((z) => clampZoom((fit ? fitScale : z) + ZOOM_STEP))
  }

  return (
    <div
      className={clsx(
        'flex h-full min-h-0 flex-col overflow-hidden',
        className
      )}
    >
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-border-subtle bg-bg-elevated/80 px-2 py-1.5">
        <button
          type="button"
          title="Zoom out"
          onClick={zoomOut}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-bg-card hover:text-text-primary"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Reset to 100%"
          onClick={() => {
            setFit(false)
            setZoom(1)
          }}
          className="min-w-[3.25rem] rounded-full px-2 py-1 text-center font-mono text-[11.5px] tabular-nums text-text-secondary hover:bg-bg-card hover:text-text-primary"
        >
          {formatZoom(displayZoom)}
        </button>
        <button
          type="button"
          title="Zoom in"
          onClick={zoomIn}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-bg-card hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Fit to width"
          onClick={() => setFit(true)}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium',
            fit
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
          )}
        >
          <Scan className="h-3.5 w-3.5" />
          Fit
        </button>
      </div>

      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto">
        <div
          ref={contentRef}
          className="origin-top-left will-change-[zoom]"
          style={{ zoom: scale }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
