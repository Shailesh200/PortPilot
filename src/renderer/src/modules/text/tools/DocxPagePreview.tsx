import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { renderAsync } from 'docx-preview'

type Props = {
  data: Uint8Array | null
  className?: string
  emptyMessage?: string
  loading?: boolean
  error?: string | null
}

/**
 * Faithful DOCX page preview (styles, pages, headers) via docx-preview.
 */
export function DocxPagePreview({
  data,
  className,
  emptyMessage = 'No Word document to preview.',
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

    const run = async () => {
      setRendering(true)
      try {
        // Copy — some parsers detach/transfer buffers
        const copy = new Uint8Array(data)
        await renderAsync(copy, host, undefined, {
          className: 'pp-docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          useBase64URL: true
        })
        if (cancelled) host.replaceChildren()
      } catch (e) {
        if (!cancelled) {
          setRenderError(
            e instanceof Error ? e.message : 'Could not render DOCX'
          )
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    void run()

    return () => {
      cancelled = true
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
        <p className="mb-3 text-[12.5px] text-text-muted">Rendering document…</p>
      )}
      {!data && !busy && !showError && (
        <p className="text-[13px] text-text-muted">{emptyMessage}</p>
      )}
      <div
        ref={hostRef}
        className={clsx(
          'pp-docx-host min-h-[1px]',
          '[&_.pp-docx-wrapper]:bg-transparent',
          '[&_.pp-docx]:bg-white [&_.pp-docx]:text-black [&_.pp-docx]:shadow-[0_1px_4px_rgba(0,0,0,0.35)]',
          '[&_.pp-docx]:mx-auto [&_.pp-docx]:mb-4',
          '[&_section.pp-docx]:bg-white'
        )}
      />
    </div>
  )
}
