import { useMemo, useState } from 'react'
import * as Diff from 'diff'
import { ToolButton, ToolPane, monoArea } from './toolUi'

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    return Object.keys(value as object)
      .sort()
      .reduce(
        (acc, k) => {
          acc[k] = sortJson((value as Record<string, unknown>)[k])
          return acc
        },
        {} as Record<string, unknown>
      )
  }
  return value
}

export function JsonDiff() {
  const [left, setLeft] = useState('{\n  "a": 1\n}')
  const [right, setRight] = useState('{\n  "a": 2,\n  "b": true\n}')
  const [ignoreKeyOrder, setIgnoreKeyOrder] = useState(true)
  const [mode, setMode] = useState<'semantic' | 'line'>('semantic')

  const result = useMemo(() => {
    try {
      let a = JSON.parse(left)
      let b = JSON.parse(right)
      if (ignoreKeyOrder) {
        a = sortJson(a)
        b = sortJson(b)
      }
      const leftStr = JSON.stringify(a, null, 2)
      const rightStr = JSON.stringify(b, null, 2)
      const parts = Diff.diffLines(leftStr, rightStr)
      return { ok: true as const, parts, leftStr, rightStr }
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Invalid JSON'
      }
    }
  }, [left, right, ignoreKeyOrder])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-border-strong overflow-hidden">
          {(['semantic', 'line'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs capitalize ${mode === m ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={ignoreKeyOrder}
            onChange={(e) => setIgnoreKeyOrder(e.target.checked)}
          />
          Ignore key order
        </label>
        <div className="flex-1" />
        <ToolButton
          onClick={() => {
            setLeft(right)
            setRight(left)
          }}
        >
          Swap
        </ToolButton>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <ToolPane title="Left">
          <textarea
            className={monoArea}
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
        <ToolPane title="Right">
          <textarea
            className={monoArea}
            value={right}
            onChange={(e) => setRight(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
      </div>
      <ToolPane title="Diff" className="h-48 flex-shrink-0">
        {!result.ok ? (
          <p className="px-3 py-2 text-xs text-danger">{result.error}</p>
        ) : (
          <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap">
            {result.parts.map((p, i) => (
              <span
                key={i}
                className={
                  p.added
                    ? 'bg-success/15 text-success'
                    : p.removed
                      ? 'bg-danger/15 text-danger'
                      : 'text-text-secondary'
                }
              >
                {p.value}
              </span>
            ))}
          </pre>
        )}
      </ToolPane>
    </div>
  )
}
