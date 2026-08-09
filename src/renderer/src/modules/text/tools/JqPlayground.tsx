import { useMemo, useState } from 'react'
import { JSONPath } from 'jsonpath-plus'
import { ToolButton, ToolPane, monoArea } from './toolUi'

export function JqPlayground() {
  const [input, setInput] = useState(
    '{\n  "users": [{ "name": "Ada", "age": 36 }, { "name": "Grace", "age": 45 }]\n}'
  )
  const [query, setQuery] = useState('$.users[*].name')
  const [engine, setEngine] = useState<'jsonpath' | 'jq'>('jsonpath')

  const result = useMemo(() => {
    try {
      const data = JSON.parse(input)
      if (engine === 'jsonpath') {
        const out = JSONPath({ path: query, json: data })
        return {
          ok: true as const,
          text: JSON.stringify(out, null, 2),
          count: Array.isArray(out) ? out.length : 1
        }
      }
      // Lightweight jq-like: support `.`, `.key`, `.key[]`, `keys`
      const trimmed = query.trim()
      let cur: unknown = data
      if (trimmed === 'keys') {
        cur = Object.keys(data as object)
      } else if (trimmed === '.') {
        cur = data
      } else if (trimmed.startsWith('.')) {
        const parts = trimmed
          .slice(1)
          .split('.')
          .filter(Boolean)
        for (const part of parts) {
          if (part.endsWith('[]')) {
            const key = part.slice(0, -2)
            const arr = key
              ? (cur as Record<string, unknown>)[key]
              : cur
            if (!Array.isArray(arr)) throw new Error(`Not an array at ${part}`)
            cur = arr
          } else {
            cur = (cur as Record<string, unknown>)[part]
          }
        }
      } else {
        throw new Error('Use JSONPath mode, or simple jq paths like .users[]')
      }
      return {
        ok: true as const,
        text: JSON.stringify(cur, null, 2),
        count: Array.isArray(cur) ? cur.length : 1
      }
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Query failed'
      }
    }
  }, [input, query, engine])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-border-strong overflow-hidden">
          {(['jsonpath', 'jq'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setEngine(m)}
              className={`px-2.5 py-1 text-xs uppercase ${engine === m ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}
            >
              {m === 'jsonpath' ? 'JSONPath' : 'jq-lite'}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-xs font-mono"
          placeholder={engine === 'jsonpath' ? '$.users[*].name' : '.users[]'}
        />
        <ToolButton
          variant="primary"
          disabled={!result.ok}
          onClick={() => {
            if (result.ok) void navigator.clipboard.writeText(result.text)
          }}
        >
          Copy result
        </ToolButton>
      </div>
      <div className="flex gap-2 flex-wrap">
        {['$.users[*].name', '$.users[0]', 'keys', '.users'].map((chip) => (
          <button
            key={chip}
            onClick={() => setQuery(chip)}
            className="px-2 py-0.5 rounded-md text-[10px] bg-bg-elevated text-text-muted border border-border-subtle hover:text-text-primary"
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <ToolPane title="Input JSON">
          <textarea
            className={monoArea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
        <ToolPane
          title="Output"
          badge={
            result.ok ? (
              <span className="text-[10px] text-text-muted">
                {result.count} result(s)
              </span>
            ) : null
          }
        >
          {result.ok ? (
            <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap">
              {result.text}
            </pre>
          ) : (
            <p className="px-3 py-2 text-xs text-danger">{result.error}</p>
          )}
        </ToolPane>
      </div>
    </div>
  )
}
