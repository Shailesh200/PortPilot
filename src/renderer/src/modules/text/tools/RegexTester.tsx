import { useMemo, useState } from 'react'
import { ToolPane, monoArea } from './toolUi'

export function RegexTester() {
  const [pattern, setPattern] = useState('(\\w+)@(\\w+)\\.(\\w+)')
  const [flags, setFlags] = useState('g')
  const [text, setText] = useState('Contact ada@example.com or grace@navy.gov')

  const result = useMemo(() => {
    try {
      const re = new RegExp(pattern, flags)
      const matches: {
        index: number
        match: string
        groups: string[]
      }[] = []
      if (flags.includes('g')) {
        let m: RegExpExecArray | null
        const clone = new RegExp(pattern, flags)
        while ((m = clone.exec(text)) !== null) {
          matches.push({
            index: m.index,
            match: m[0],
            groups: m.slice(1)
          })
          if (m[0].length === 0) clone.lastIndex++
        }
      } else {
        const m = re.exec(text)
        if (m) {
          matches.push({ index: m.index, match: m[0], groups: m.slice(1) })
        }
      }
      return { ok: true as const, matches, re: re.toString() }
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Invalid regex'
      }
    }
  }, [pattern, flags, text])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted font-mono">/</span>
        <input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          className="flex-1 bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-xs font-mono"
        />
        <span className="text-xs text-text-muted font-mono">/</span>
        <input
          value={flags}
          onChange={(e) => setFlags(e.target.value)}
          className="w-16 bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs font-mono"
          placeholder="flags"
        />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <ToolPane title="Test string">
          <textarea
            className={monoArea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
        <ToolPane title="Matches">
          {!result.ok ? (
            <p className="px-3 py-2 text-xs text-danger">{result.error}</p>
          ) : result.matches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted">No matches</p>
          ) : (
            <ul className="p-3 space-y-2">
              {result.matches.map((m, i) => (
                <li
                  key={i}
                  className="text-xs border border-border-subtle rounded-lg p-2 bg-bg-surface"
                >
                  <div className="font-mono text-accent">{m.match}</div>
                  <div className="text-text-muted mt-1">index {m.index}</div>
                  {m.groups.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {m.groups.map((g, gi) => (
                        <div key={gi} className="font-mono text-text-secondary">
                          ${gi + 1}: {g}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ToolPane>
      </div>
      <p className="text-[11px] text-text-muted">
        Tip: use flags <code className="font-mono">g</code>,{' '}
        <code className="font-mono">i</code>, <code className="font-mono">m</code>,{' '}
        <code className="font-mono">s</code>. Groups appear as $1, $2, …
      </p>
    </div>
  )
}
