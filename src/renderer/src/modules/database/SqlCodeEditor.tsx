import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql, PostgreSQL, MySQL, StandardSQL } from '@codemirror/lang-sql'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { Prec } from '@codemirror/state'
import { portpilotEditorTheme } from '../text/tools/jsEditorTheme'
import type { DbConnectionPublic } from '../../../../shared/types'

function dialectFor(engine?: DbConnectionPublic['engine']) {
  if (engine === 'mysql') return MySQL
  if (engine === 'postgres' || engine === 'libsql' || engine === 'sqlite') {
    return PostgreSQL
  }
  return StandardSQL
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
  const wrapRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef('')

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

  const extensions = [
    sql({ dialect: dialectFor(engine) }),
    portpilotEditorTheme(dark),
    EditorView.lineWrapping,
    keymap.of([indentWithTab]),
    Prec.highest(
      keymap.of([
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
    EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const sel = update.state.selection.main
        selectionRef.current = update.state.sliceDoc(sel.from, sel.to)
      }
    })
  ]

  return (
    <div ref={wrapRef} className="min-h-0 flex-1 overflow-hidden">
      {height > 0 && (
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
    </div>
  )
}
