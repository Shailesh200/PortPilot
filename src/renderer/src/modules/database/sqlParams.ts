/** Named SQL params: :name or $name (not $$dollar quoting). */

const PARAM_RE = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)\b|\$(?:\{)?([a-zA-Z_][a-zA-Z0-9_]*)\}?/g

export function extractSqlParams(sql: string): string[] {
  const found = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(PARAM_RE.source, 'g')
  while ((m = re.exec(sql))) {
    const name = m[1] || m[2]
    if (name) found.add(name)
  }
  return Array.from(found)
}

function sqlLiteral(v: string): string {
  if (v === '' || v.toLowerCase() === 'null') return 'NULL'
  if (/^-?\d+(\.\d+)?$/.test(v)) return v
  if (v === 'true' || v === 'false') return v.toUpperCase()
  return `'${v.replace(/'/g, "''")}'`
}

/** Replace :name / $name with literals. Unset params become NULL. */
export function applySqlParams(
  sql: string,
  params: Record<string, string>
): string {
  return sql.replace(PARAM_RE, (_full, colonName?: string, dollarName?: string) => {
    const name = colonName || dollarName || ''
    const raw = params[name]
    if (raw == null || raw === '') return 'NULL'
    return sqlLiteral(raw)
  })
}

export { parseCsvTable as parseCsv } from '@/lib/csv'
