import { useEffect, useMemo, useState } from 'react'
import { useHandoffStore } from '../../../stores/handoffStore'
import { ToolButton, ToolPane, monoArea } from './toolUi'

type Mode = 'raw' | 'tree'

function JsonTree({ value, path = 'root' }: { value: unknown; path?: string }) {
  if (value === null) return <span className="text-text-muted">null</span>
  if (typeof value !== 'object') {
    const color =
      typeof value === 'string'
        ? 'text-success'
        : typeof value === 'number'
          ? 'text-info'
          : typeof value === 'boolean'
            ? 'text-warning'
            : 'text-text-secondary'
    return (
      <span className={color}>
        {typeof value === 'string' ? JSON.stringify(value) : String(value)}
      </span>
    )
  }
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>)
  return (
    <ul className="pl-3 border-l border-border-subtle space-y-0.5">
      {entries.map(([k, v]) => (
        <li key={`${path}.${k}`} className="text-xs font-mono">
          <span className="text-accent">{k}</span>
          <span className="text-text-muted">: </span>
          {v !== null && typeof v === 'object' ? (
            <details open className="inline">
              <summary className="cursor-pointer text-text-muted inline">
                {Array.isArray(v) ? `array[${v.length}]` : 'object'}
              </summary>
              <JsonTree value={v} path={`${path}.${k}`} />
            </details>
          ) : (
            <JsonTree value={v} path={`${path}.${k}`} />
          )}
        </li>
      ))}
    </ul>
  )
}

export function JsonFormatter() {
  const [input, setInput] = useState('{\n  "hello": "portpilot"\n}')
  const [indent, setIndent] = useState(2)
  const [mode, setMode] = useState<Mode>('raw')
  const [sortKeys, setSortKeys] = useState(false)
  const take = useHandoffStore((s) => s.take)

  useEffect(() => {
    const { payload } = take()
    if (payload) setInput(payload)
  }, [take])

  const result = useMemo(() => {
    try {
      let parsed = JSON.parse(input)
      if (sortKeys) {
        parsed = JSON.parse(
          JSON.stringify(parsed, (_, v) => {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return Object.keys(v)
                .sort()
                .reduce(
                  (acc, k) => {
                    acc[k] = v[k]
                    return acc
                  },
                  {} as Record<string, unknown>
                )
            }
            return v
          })
        )
      }
      const formatted = JSON.stringify(parsed, null, indent)
      return { ok: true as const, formatted, parsed }
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Invalid JSON'
      }
    }
  }, [input, indent, sortKeys])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-border-strong overflow-hidden">
          {(['raw', 'tree'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs capitalize ${mode === m ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <select
          value={indent}
          onChange={(e) => setIndent(Number(e.target.value))}
          className="bg-bg-elevated border border-border-strong rounded-md px-2 py-1 text-xs"
        >
          <option value={2}>Indent 2</option>
          <option value={4}>Indent 4</option>
          <option value={0}>Minified</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={sortKeys}
            onChange={(e) => setSortKeys(e.target.checked)}
          />
          Sort keys
        </label>
        <div className="flex-1" />
        <ToolButton
          onClick={async () => setInput(await navigator.clipboard.readText())}
        >
          Paste
        </ToolButton>
        <ToolButton
          variant="primary"
          disabled={!result.ok}
          onClick={() => {
            if (result.ok) void navigator.clipboard.writeText(result.formatted)
          }}
        >
          Copy
        </ToolButton>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <ToolPane title="Input">
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
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${result.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
            >
              {result.ok ? 'valid' : 'error'}
            </span>
          }
        >
          {result.ok ? (
            mode === 'raw' ? (
              <pre className="px-3 py-2 text-xs font-mono text-text-primary whitespace-pre-wrap">
                {result.formatted}
              </pre>
            ) : (
              <div className="px-3 py-2">
                <JsonTree value={result.parsed} />
              </div>
            )
          ) : (
            <p className="px-3 py-2 text-xs text-danger">{result.error}</p>
          )}
        </ToolPane>
      </div>
    </div>
  )
}
