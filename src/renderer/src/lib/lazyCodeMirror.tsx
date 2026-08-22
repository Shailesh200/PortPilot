import { useEffect, useRef, useState } from 'react'
import type { Extension } from '@codemirror/state'

type CodeMirrorComponent = typeof import('@uiw/react-codemirror').default

export function useLazyCodeMirror<T>(load: () => Promise<T>): T | null {
  const loadRef = useRef(load)
  loadRef.current = load
  const [bundle, setBundle] = useState<T | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadRef.current().then((next) => {
      if (!cancelled) setBundle(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return bundle
}

/**
 * CodeMirror only scrolls when it has a real pixel height. Percentage heights
 * often collapse in nested flex panes, so we measure the host with ResizeObserver.
 */
export function FillCodeMirror({
  value,
  extensions,
  onChange,
  editable = true,
  CodeMirror,
  placeholder,
  basicSetup
}: {
  value: string
  extensions: Extension[]
  onChange?: (v: string) => void
  editable?: boolean
  CodeMirror: CodeMirrorComponent
  placeholder?: string
  basicSetup?: boolean | Record<string, boolean>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [heightPx, setHeightPx] = useState(0)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const apply = () => {
      const next = Math.max(0, Math.floor(el.getBoundingClientRect().height))
      setHeightPx((prev) => (prev === next ? prev : next))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden">
      {heightPx > 0 && (
        <CodeMirror
          value={value}
          height={`${heightPx}px`}
          maxHeight={`${heightPx}px`}
          theme="none"
          placeholder={placeholder}
          basicSetup={
            basicSetup ?? {
              foldGutter: true,
              highlightActiveLine: editable,
              highlightSelectionMatches: false
            }
          }
          extensions={extensions}
          editable={editable}
          onChange={onChange}
          style={{
            height: heightPx,
            maxHeight: heightPx,
            overflow: 'hidden'
          }}
          className="[&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:!overflow-auto"
        />
      )}
    </div>
  )
}
