import { parse, unparse } from 'papaparse'

export function parseCsvTable(text: string): {
  columns: string[]
  rows: string[][]
} {
  const r = parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy'
  })
  const data = (r.data || []).filter((row) =>
    Array.isArray(row) ? row.some((c) => String(c).length > 0) : false
  ) as string[][]
  if (data.length === 0) return { columns: [], rows: [] }
  const columns = data[0].map((c, i) => String(c ?? '').trim() || `col${i + 1}`)
  return {
    columns,
    rows: data.slice(1).map((row) =>
      columns.map((_, i) => String(row[i] ?? ''))
    )
  }
}

export function parseCsvRecords(
  text: string,
  delimiter?: string
): Record<string, unknown>[] {
  const r = parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    ...(delimiter ? { delimiter } : {})
  })
  const fatal = r.errors.filter((e) => e.code !== 'UndetectableDelimiter')
  if (fatal.length && !r.data.length) {
    throw new Error(fatal[0].message)
  }
  return r.data
}

export function unparseCsv(rows: string[][]): string
export function unparseCsv(rows: Record<string, unknown>[]): string
export function unparseCsv(
  rows: Record<string, unknown>[] | string[][]
): string {
  if (rows.length === 0) return ''
  if (Array.isArray(rows[0])) {
    return unparse(rows as string[][])
  }
  return unparse(rows as Record<string, unknown>[])
}
