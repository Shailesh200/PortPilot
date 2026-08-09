import { useMemo, useState } from 'react'
import { ToolPane, monoArea } from './toolUi'

export function UnicodeInspector() {
  const [input, setInput] = useState('PortPilot ₹ ✓ 🚀')

  const rows = useMemo(() => {
    const out: {
      char: string
      codepoint: string
      name: string
      entity: string
    }[] = []
    for (const char of input) {
      const cp = char.codePointAt(0)!
      const hex = cp.toString(16).toUpperCase().padStart(4, '0')
      let name = ''
      try {
        name = (Intl as unknown as { getCharacterName?: (n: number) => string }).getCharacterName?.(cp) || ''
      } catch {
        name = ''
      }
      out.push({
        char,
        codepoint: `U+${hex}`,
        name: name || (cp < 32 ? 'control' : ''),
        entity: cp > 127 ? `&#${cp};` : char
      })
    }
    return out
  }, [input])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <ToolPane title="Input" className="h-28 flex-shrink-0">
        <textarea
          className={monoArea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
      </ToolPane>
      <ToolPane title="Codepoints">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-card">
            <tr className="border-b border-border text-text-muted text-[10px] uppercase">
              <th className="text-left px-3 py-2">Glyph</th>
              <th className="text-left px-3 py-2">Codepoint</th>
              <th className="text-left px-3 py-2">Entity</th>
              <th className="text-left px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border-subtle/50">
                <td className="px-3 py-2 text-lg">{r.char}</td>
                <td className="px-3 py-2 font-mono text-accent">{r.codepoint}</td>
                <td className="px-3 py-2 font-mono text-text-secondary">
                  {r.entity}
                </td>
                <td className="px-3 py-2 text-text-muted">{r.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ToolPane>
    </div>
  )
}
