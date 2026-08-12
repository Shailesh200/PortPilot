import { useEffect, useMemo, useRef, useState } from 'react'
import type { Extension } from '@codemirror/state'
import { portpilotEditorTheme } from '../text/tools/jsEditorTheme'
import type { DbConnectionPublic } from '../../../../shared/types'

type CmBundle = {
  CodeMirror: typeof import('@uiw/react-codemirror').default
  sql: typeof import('@codemirror/lang-sql').sql
  PostgreSQL: typeof import('@codemirror/lang-sql').PostgreSQL
  MySQL: typeof import('@codemirror/lang-sql').MySQL
  StandardSQL: typeof import('@codemirror/lang-sql').StandardSQL
  EditorView: typeof import('@codemirror/view').EditorView
  keymap: typeof import('@codemirror/view').keymap
  indentWithTab: typeof import('@codemirror/commands').indentWithTab
  Prec: typeof import('@codemirror/state').Prec
}

function dialectFor(
  cm: CmBundle,
  engine?: DbConnectionPublic['engine']
) {
  if (engine === 'mysql') return cm.MySQL
  if (engine === 'postgres' || engine === 'libsql' || engine === 'sqlite') {
    return cm.PostgreSQL
  }
  return cm.StandardSQL
}

export function SqlCodeEditor({
  value,
  onChange,
  onRun,
  engine,
  placeholder = 'Write a SQL query…'
}: {
  value: string
  onChange: (v: string) => void
  onRun: (sql: string) => void
  engine?: DbConnectionPublic['engine']
  placeholder?: string
}) {
  const dark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  const [height, setHeight] = useState(0)
  const [cm, setCm] = useState<CmBundle | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [cmMod, sqlMod, viewMod, cmdMod, stateMod] = await Promise.all([
        import('@uiw/react-codemirror'),
        import('@codemirror/lang-sql'),
        import('@codemirror/view'),
        import('@codemirror/commands'),
        import('@codemirror/state')
      ])
      if (cancelled) return
      setCm({
        CodeMirror: cmMod.default,
        sql: sqlMod.sql,
        PostgreSQL: sqlMod.PostgreSQL,
        MySQL: sqlMod.MySQL,
        StandardSQL: sqlMod.StandardSQL,
        EditorView: viewMod.EditorView,
        keymap: viewMod.keymap,
        indentWithTab: cmdMod.indentWithTab,
        Prec: stateMod.Prec
      })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setHeight(el.clientHeight)
    })
    ro.observe(el)
    setHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const extensions = useMemo((): Extension[] => {
    if (!cm) return []
    return [
      cm.sql({ dialect: dialectFor(cm, engine) }),
      portpilotEditorTheme(dark),
      cm.EditorView.lineWrapping,
      cm.keymap.of([cm.indentWithTab]),
      cm.Prec.highest(
        cm.keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              const selected = selectionRef.current.trim()
              onRun(selected || value)
              return true
            }
          }
        ])
      ),
      cm.EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          const sel = update.state.selection.main
          selectionRef.current = update.state.sliceDoc(sel.from, sel.to)
        }
      })
    ]
  }, [cm, dark, engine, onRun, value])

  const CodeMirror = cm?.CodeMirror

  return (
    <div ref={wrapRef} className="min-h-0 flex-1 overflow-hidden">
      {height > 0 && CodeMirror && (
        <CodeMirror
          value={value}
          height={`${height}px`}
          theme="none"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            bracketMatching: true,
            autocompletion: true
          }}
          extensions={extensions}
          placeholder={placeholder}
          onChange={onChange}
        />
      )}
      {height > 0 && !CodeMirror && (
        <p className="p-3 text-[12.5px] text-text-muted">Loading editor…</p>
      )}
    </div>
  )
}
