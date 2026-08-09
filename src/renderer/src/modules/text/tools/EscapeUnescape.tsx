import { useMemo, useState } from 'react'
import { ToolButton, ToolPane, monoArea } from './toolUi'

type Mode =
  | 'url'
  | 'html'
  | 'sql'
  | 'shell'
  | 'json'

function escapeValue(mode: Mode, s: string): string {
  switch (mode) {
    case 'url':
      return encodeURIComponent(s)
    case 'html':
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    case 'sql':
      return s.replace(/'/g, "''")
    case 'shell':
      return `'${s.replace(/'/g, `'\\''`)}'`
    case 'json':
      return JSON.stringify(s)
  }
}

function unescapeValue(mode: Mode, s: string): string {
  switch (mode) {
    case 'url':
      return decodeURIComponent(s)
    case 'html': {
      const el = document.createElement('textarea')
      el.innerHTML = s
      return el.value
    }
    case 'sql':
      return s.replace(/''/g, "'")
    case 'shell':
      if (s.startsWith("'") && s.endsWith("'")) {
        return s.slice(1, -1).replace(/'\\''/g, "'")
      }
      return s
    case 'json':
      return JSON.parse(s)
  }
}

export function EscapeUnescape() {
  const [mode, setMode] = useState<Mode>('url')
  const [direction, setDirection] = useState<'escape' | 'unescape'>('escape')
  const [input, setInput] = useState('hello world & <friends>')

  const result = useMemo(() => {
    try {
      const text =
        direction === 'escape'
          ? escapeValue(mode, input)
          : unescapeValue(mode, input)
      return { ok: true as const, text: String(text) }
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Failed'
      }
    }
  }, [mode, direction, input])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['url', 'html', 'sql', 'shell', 'json'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded-md text-xs uppercase border ${mode === m ? 'border-accent text-accent bg-accent/10' : 'border-border-strong text-text-secondary'}`}
          >
            {m}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() =>
            setDirection((d) => (d === 'escape' ? 'unescape' : 'escape'))
          }
          className="text-xs px-2.5 py-1 rounded-md bg-bg-elevated border border-border-strong"
        >
          {direction === 'escape' ? 'Escape →' : '← Unescape'}
        </button>
        <ToolButton
          variant="primary"
          disabled={!result.ok}
          onClick={() => {
            if (result.ok) void navigator.clipboard.writeText(result.text)
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
        <ToolPane title="Output">
          {result.ok ? (
            <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all">
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
