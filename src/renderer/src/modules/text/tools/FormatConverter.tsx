import { useMemo, useState } from 'react'
import * as yaml from 'js-yaml'
import * as TOML from '@iarna/toml'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import { parse as parseCsv, unparse as unparseCsv } from 'papaparse'
import { ToolButton, ToolPane, monoArea } from './toolUi'

type Fmt = 'json' | 'yaml' | 'toml' | 'xml' | 'csv'

function parse(fmt: Fmt, text: string): unknown {
  switch (fmt) {
    case 'json':
      return JSON.parse(text)
    case 'yaml':
      return yaml.load(text)
    case 'toml':
      return TOML.parse(text)
    case 'xml':
      return new XMLParser({ ignoreAttributes: false }).parse(text)
    case 'csv': {
      const r = parseCsv(text.trim(), { header: true, skipEmptyLines: true })
      if (r.errors.length) throw new Error(r.errors[0].message)
      return r.data
    }
  }
}

function stringify(fmt: Fmt, data: unknown): string {
  switch (fmt) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'yaml':
      return yaml.dump(data)
    case 'toml':
      return TOML.stringify(data as TOML.JsonMap)
    case 'xml':
      return new XMLBuilder({ ignoreAttributes: false, format: true }).build(
        data
      )
    case 'csv': {
      if (!Array.isArray(data)) throw new Error('CSV output needs an array of objects')
      return unparseCsv(data as object[])
    }
  }
}

export function FormatConverter() {
  const [from, setFrom] = useState<Fmt>('yaml')
  const [to, setTo] = useState<Fmt>('json')
  const [input, setInput] = useState('name: PortPilot\nversion: 1\n')

  const result = useMemo(() => {
    try {
      const data = parse(from, input)
      return { ok: true as const, text: stringify(to, data) }
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : 'Conversion failed'
      }
    }
  }, [from, to, input])

  const formats: Fmt[] = ['json', 'yaml', 'toml', 'xml', 'csv']

  return (
    <div className="h-full flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value as Fmt)}
          className="bg-bg-elevated border border-border-strong rounded-md px-2 py-1 text-xs uppercase"
        >
          {formats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="text-xs text-text-muted">→</span>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value as Fmt)}
          className="bg-bg-elevated border border-border-strong rounded-md px-2 py-1 text-xs uppercase"
        >
          {formats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className="flex-1" />
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
        <ToolPane title={`Input (${from})`}>
          <textarea
            className={monoArea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
        </ToolPane>
        <ToolPane title={`Output (${to})`}>
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
