import { useMemo, useState } from 'react'
import * as Diff from 'diff'
import { ToolPane, monoArea } from './toolUi'

export function TextDiff() {
  const [left, setLeft] = useState('hello world\nfoo')
  const [right, setRight] = useState('hello portpilot\nfoo\nbar')
  const [split, setSplit] = useState(false)

  const parts = useMemo(() => Diff.diffLines(left, right), [left, right])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={split}
            onChange={(e) => setSplit(e.target.checked)}
          />
          Split view inputs
        </label>
      </div>
      <div
        className={`flex-1 grid gap-3 min-h-0 ${split ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        <ToolPane title="Original">
          <textarea
            className={monoArea}
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
        {split && (
          <ToolPane title="Modified">
            <textarea
              className={monoArea}
              value={right}
              onChange={(e) => setRight(e.target.value)}
              spellCheck={false}
            />
          </ToolPane>
        )}
      </div>
      {!split && (
        <ToolPane title="Modified" className="h-32 flex-shrink-0">
          <textarea
            className={monoArea}
            value={right}
            onChange={(e) => setRight(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
      )}
      <ToolPane title="Unified diff" className="h-48 flex-shrink-0">
        <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap">
          {parts.map((p, i) => (
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
              {(p.added ? '+' : p.removed ? '-' : ' ') +
                p.value.replace(/\n$/, '')}
              {'\n'}
            </span>
          ))}
        </pre>
      </ToolPane>
    </div>
  )
}
