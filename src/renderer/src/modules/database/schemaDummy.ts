import type { DbColumnInfo, DbTableSchema } from '../../../../shared/types'

function dummyForColumn(col: DbColumnInfo, i: number): unknown {
  const t = (col.type || '').toLowerCase()
  const n = col.name.toLowerCase()
  if (col.isPrimaryKey && /int|serial|number/.test(t)) return undefined
  if (n.includes('email')) return `user${i}@example.test`
  if (n.includes('name')) return `Sample ${i}`
  if (n === 'id' && /uuid|char|text/.test(t)) {
    return `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
  }
  if (/bool/.test(t)) return i % 2 === 0
  if (/json/.test(t)) return { seed: true, n: i }
  if (/date|time/.test(t)) return new Date().toISOString()
  if (/int|numeric|decimal|float|double|real|money/.test(t)) return i
  if (col.defaultValue) return undefined
  if (col.nullable) return null
  return `seed-${i}`
}

export function dummyRowFromSchema(
  schema: DbTableSchema,
  index = 1
): { columns: string[]; values: unknown[] } {
  const columns: string[] = []
  const values: unknown[] = []
  for (const col of schema.columns) {
    const value = dummyForColumn(col, index)
    if (value === undefined) continue
    columns.push(col.name)
    values.push(value)
  }
  return { columns, values }
}
