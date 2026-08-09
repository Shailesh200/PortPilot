import { useMemo, useState } from 'react'
import { parse as parseCsv, unparse as unparseCsv } from 'papaparse'
import { ToolButton, ToolPane, monoArea } from './toolUi'

export function CsvViewer() {
  const [raw, setRaw] = useState(
    'name,city,role\nAda,London,Engineer\nGrace,New York,Admiral\n'
  )
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const parsed = useMemo(() => {
    const r = parseCsv<Record<string, string>>(raw.trim(), {
      header: true,
      skipEmptyLines: true
    })
    if (r.errors.length && !r.data.length) {
      return { ok: false as const, error: r.errors[0].message }
    }
    const fields = r.meta.fields || []
    let rows = r.data
    if (filter) {
      const q = filter.toLowerCase()
      rows = rows.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(q))
      )
    }
    if (sortKey && fields.includes(sortKey)) {
      rows = [...rows].sort((a, b) => {
        const av = String(a[sortKey] ?? '')
        const bv = String(b[sortKey] ?? '')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return { ok: true as const, fields, rows }
  }, [raw, filter, sortKey, sortDir])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rows…"
          className="bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-xs w-48"
        />
        {parsed.ok && (
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="bg-bg-elevated border border-border-strong rounded-md px-2 py-1 text-xs"
          >
            <option value="">Sort by…</option>
            {parsed.fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="text-xs text-text-secondary px-2"
        >
          {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
        <div className="flex-1" />
        <ToolButton
          variant="primary"
          disabled={!parsed.ok}
          onClick={() => {
            if (!parsed.ok) return
            void navigator.clipboard.writeText(unparseCsv(parsed.rows))
          }}
        >
          Export CSV
        </ToolButton>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <ToolPane title="CSV source">
          <textarea
            className={monoArea}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
        <ToolPane title="Table">
          {!parsed.ok ? (
            <p className="px-3 py-2 text-xs text-danger">{parsed.error}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-card">
                <tr className="border-b border-border">
                  {parsed.fields.map((f) => (
                    <th
                      key={f}
                      className="text-left px-3 py-2 text-[10px] uppercase text-text-muted font-semibold cursor-pointer"
                      onClick={() => {
                        if (sortKey === f)
                          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                        else {
                          setSortKey(f)
                          setSortDir('asc')
                        }
                      }}
                    >
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-subtle/50 hover:bg-bg-hover/40"
                  >
                    {parsed.fields.map((f) => (
                      <td key={f} className="px-3 py-1.5 font-mono text-text-secondary">
                        {row[f]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ToolPane>
      </div>
    </div>
  )
}
