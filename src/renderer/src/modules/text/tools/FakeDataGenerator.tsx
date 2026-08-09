import { useMemo, useState } from 'react'
import { faker } from '@faker-js/faker/locale/en_IN'
import { unparse as unparseCsv } from 'papaparse'
import { ToolButton, ToolPane, monoArea } from './toolUi'

type OutFmt = 'json' | 'csv' | 'sql'

function row() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    city: faker.location.city(),
    company: faker.company.name()
  }
}

export function FakeDataGenerator() {
  const [count, setCount] = useState(5)
  const [fmt, setFmt] = useState<OutFmt>('json')
  const [seed, setSeed] = useState(0)

  const text = useMemo(() => {
    faker.seed(seed || 42)
    const rows = Array.from({ length: Math.min(200, Math.max(1, count)) }, () =>
      row()
    )
    if (fmt === 'json') return JSON.stringify(rows, null, 2)
    if (fmt === 'csv') return unparseCsv(rows)
    const values = rows
      .map(
        (r) =>
          `('${r.name.replace(/'/g, "''")}', '${r.email}', '${r.city.replace(/'/g, "''")}')`
      )
      .join(',\n  ')
    return `INSERT INTO users (name, email, city) VALUES\n  ${values};`
  }, [count, fmt, seed])

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-text-secondary flex items-center gap-2">
          Rows
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 bg-bg-elevated border border-border-strong rounded-md px-2 py-1 text-xs"
          />
        </label>
        {(['json', 'csv', 'sql'] as OutFmt[]).map((f) => (
          <button
            key={f}
            onClick={() => setFmt(f)}
            className={`px-2.5 py-1 rounded-md text-xs uppercase border ${fmt === f ? 'border-accent text-accent bg-accent/10' : 'border-border-strong text-text-secondary'}`}
          >
            {f}
          </button>
        ))}
        <ToolButton onClick={() => setSeed(Date.now())}>Regenerate</ToolButton>
        <div className="flex-1" />
        <span className="text-[10px] text-text-muted">Locale: en-IN</span>
        <ToolButton
          variant="primary"
          onClick={() => void navigator.clipboard.writeText(text)}
        >
          Copy
        </ToolButton>
      </div>
      <ToolPane title="Generated data" className="flex-1">
        <textarea className={monoArea} readOnly value={text} />
      </ToolPane>
    </div>
  )
}
