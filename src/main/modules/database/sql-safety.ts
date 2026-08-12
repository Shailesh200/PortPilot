/** Detect likely mutating / destructive SQL for confirm + read-only gates. */

const MUTATING =
  /^\s*(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|call|merge|upsert|copy\s+)/i

const DESTRUCTIVE =
  /^\s*(drop|truncate|alter\s+.*\s+drop|delete\s+from\s+\S+(\s+;)?\s*$)/i

export function splitSqlStatements(sql: string): string[] {
  // Naive split on ; outside simple quotes — good enough for editor “run”
  const parts: string[] = []
  let cur = ''
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    if (ch === ';' && !inSingle && !inDouble) {
      if (cur.trim()) parts.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

export function isMutatingSql(sql: string): boolean {
  return splitSqlStatements(sql).some((s) => MUTATING.test(s))
}

export function isDestructiveSql(sql: string): boolean {
  return splitSqlStatements(sql).some((s) => {
    if (/^\s*delete\s+from\b/i.test(s) && !/\bwhere\b/i.test(s)) return true
    return DESTRUCTIVE.test(s)
  })
}

export function wrapExplain(
  engine: string,
  sql: string,
  analyze: boolean
): string {
  const trimmed = sql.trim().replace(/;+\s*$/, '')
  switch (engine) {
    case 'postgres':
      return analyze ? `EXPLAIN ANALYZE ${trimmed}` : `EXPLAIN ${trimmed}`
    case 'libsql':
    case 'sqlite':
      return `EXPLAIN QUERY PLAN ${trimmed}`
    case 'mysql':
      return analyze ? `EXPLAIN ANALYZE ${trimmed}` : `EXPLAIN ${trimmed}`
    default:
      return `EXPLAIN ${trimmed}`
  }
}
