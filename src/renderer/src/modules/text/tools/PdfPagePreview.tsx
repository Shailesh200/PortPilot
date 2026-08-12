import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

type Props = {
  data: Uint8Array | null
  className?: string
  emptyMessage?: string
  loading?: boolean
  error?: string | null
}

/**
 * Renders PDF page canvases (actual document view), not extracted text.
 */
export function PdfPagePreview({
  data,
  className,
  emptyMessage = 'No PDF to preview.',
  loading = false,
  error = null
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    host.replaceChildren()
    setRenderError(null)

    if (!data || data.byteLength === 0) {
      setRendering(false)
      return
    }

    let cancelled = false
    let loadingTask: { destroy: () => Promise<void> } | null = null
    let pdfDoc: { cleanup: () => Promise<unknown> } | null = null

    const run = async () => {
      setRendering(true)
      try {
        const { getDocument } = await import('@/lib/pdfjs')
        // Copy — pdf.js may transfer/detach the buffer
        const copy = new Uint8Array(data)
        const task = getDocument({ data: copy })
        loadingTask = task
        const pdf = await task.promise
        if (cancelled) {
          await pdf.cleanup()
          return
        }
        pdfDoc = pdf

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) break
          const page = await pdf.getPage(pageNum)
          const base = page.getViewport({ scale: 1 })
          // Hi-DPI render; CSS size stays at natural page width for fit/zoom.
          const renderScale = Math.min(2.5, (window.devicePixelRatio || 1) * 1.25)
          const viewport = page.getViewport({ scale: renderScale })

          const canvas = document.createElement('canvas')
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          canvas.style.width = `${Math.floor(base.width)}px`
          canvas.style.height = `${Math.floor(base.height)}px`
          canvas.className =
            'mx-auto mb-3 block rounded-sm bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)]'
          canvas.setAttribute('aria-label', `Page ${pageNum}`)

          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          if (cancelled) break
          host.appendChild(canvas)
        }
      } catch (e) {
        if (!cancelled) {
          setRenderError(
            e instanceof Error ? e.message : 'Could not render PDF'
          )
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    void run()

    return () => {
      cancelled = true
      void loadingTask?.destroy()
      void pdfDoc?.cleanup()
      host.replaceChildren()
    }
  }, [data])

  const showError = error || renderError
  const busy = loading || rendering

  return (
    <div className={clsx('p-3', className)}>
      {showError && (
        <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {showError}
        </div>
      )}
      {busy && !showError && (
        <p className="mb-3 text-[12.5px] text-text-muted">Rendering PDF…</p>
      )}
      {!data && !busy && !showError && (
        <p className="text-[13px] text-text-muted">{emptyMessage}</p>
      )}
      <div ref={hostRef} className="min-h-[1px]" />
    </div>
  )
}
