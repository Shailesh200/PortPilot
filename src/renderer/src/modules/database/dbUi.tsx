import { clsx } from 'clsx'
import { useState, type ReactNode } from 'react'
import type { DbConnectionPublic } from '../../../../shared/types'

export const ENGINE_LABEL: Record<DbConnectionPublic['engine'], string> = {
  postgres: 'PG',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  redis: 'Redis',
  mongodb: 'Mongo',
  libsql: 'Turso'
}

export const ENGINE_FULL: Record<DbConnectionPublic['engine'], string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  redis: 'Redis',
  mongodb: 'MongoDB',
  libsql: 'Turso'
}

export function connectionEndpoint(c: DbConnectionPublic): string {
  if (c.engine === 'sqlite') return c.filePath || 'No file'
  if (c.engine === 'libsql') {
    const h = c.host || 'No URL'
    return h.length > 48 ? `${h.slice(0, 48)}…` : h
  }
  const raw = (c.host || '').trim()
  if (/^postgres(ql)?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      const db = u.pathname.replace(/^\//, '')
      return `${u.hostname}${u.port ? `:${u.port}` : ''}${db ? `/${db}` : ''}`
    } catch {
      return 'Invalid URL'
    }
  }
  const host = c.host || 'localhost'
  const port = c.port != null ? `:${c.port}` : ''
  return `${host}${port}`
}

export function relativeTime(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[10px] font-medium uppercase tracking-wider text-text-muted">
      {children}
    </label>
  )
}

export function FieldInput({
  className,
  mono,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full rounded-md border border-border-strong bg-bg-elevated px-3 py-2 text-[13px] text-text-primary outline-none transition-colors',
        'placeholder:text-text-muted/60 focus:border-accent focus:ring-1 focus:ring-accent',
        mono && 'font-mono text-[12px]',
        className
      )}
    />
  )
}

export function StatusDot({
  tone
}: {
  tone: 'connected' | 'idle' | 'error' | 'warning'
}) {
  return (
    <span
      className={clsx(
        'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-bg-card',
        tone === 'connected' && 'bg-success',
        tone === 'idle' && 'bg-text-muted',
        tone === 'error' && 'bg-danger',
        tone === 'warning' && 'bg-warning'
      )}
    />
  )
}

export function EngineBadge({
  engine
}: {
  engine: DbConnectionPublic['engine']
}) {
  return (
    <span className="rounded border border-border-subtle bg-bg-elevated px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-text-muted">
      {ENGINE_LABEL[engine]}
    </span>
  )
}

export function ResultGrid({
  columns,
  rows,
  selectedRow,
  onSelectRow,
  className,
  rowOffset = 0,
  editable,
  onCellCommit
}: {
  columns: string[]
  rows: unknown[][]
  selectedRow?: number | null
  onSelectRow?: (i: number) => void
  className?: string
  rowOffset?: number
  editable?: boolean
  onCellCommit?: (rowIndex: number, colIndex: number, value: string) => void
}) {
  const [editing, setEditing] = useState<{
    row: number
    col: number
    value: string
  } | null>(null)

  return (
    <div className={clsx('min-h-0 flex-1 overflow-auto', className)}>
      <table className="w-full border-collapse whitespace-nowrap text-left font-mono text-[12px]">
        <thead className="sticky top-0 z-10 bg-bg-elevated shadow-sm">
          <tr>
            <th className="w-10 border-b border-r border-border-subtle px-3 py-1.5 text-center font-medium text-text-muted">
              #
            </th>
            {columns.map((c) => (
              <th
                key={c}
                className="border-b border-r border-border-subtle px-3 py-1.5 font-medium text-text-secondary last:border-r-0"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onSelectRow?.(i)}
              className={clsx(
                'border-b border-border-subtle/50 transition-colors',
                onSelectRow && 'cursor-pointer',
                selectedRow === i
                  ? 'bg-accent/10'
                  : 'hover:bg-bg-hover'
              )}
            >
              <td className="border-r border-border-subtle/50 px-3 py-1.5 text-center text-text-muted">
                {rowOffset + i + 1}
              </td>
              {row.map((cell, j) => {
                const isEdit =
                  editable && editing?.row === i && editing.col === j
                return (
                  <td
                    key={j}
                    className="max-w-[280px] truncate border-r border-border-subtle/50 px-3 py-1.5 text-text-secondary last:border-r-0"
                    title={cell == null ? 'NULL' : String(cell)}
                    onDoubleClick={(e) => {
                      if (!editable || !onCellCommit) return
                      e.stopPropagation()
                      setEditing({
                        row: i,
                        col: j,
                        value: cell == null ? '' : String(cell)
                      })
                    }}
                  >
                    {isEdit ? (
                      <input
                        autoFocus
                        className="w-full min-w-[80px] rounded border border-accent bg-bg px-1 py-0.5 outline-none"
                        value={editing.value}
                        onChange={(e) =>
                          setEditing({ ...editing, value: e.target.value })
                        }
                        onBlur={() => {
                          onCellCommit?.(i, j, editing.value)
                          setEditing(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onCellCommit?.(i, j, editing.value)
                            setEditing(null)
                          }
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : cell == null ? (
                      <span className="italic text-text-muted">NULL</span>
                    ) : (
                      String(cell)
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function emptyConnectionForm(): {
  id: string
  name: string
  engine: DbConnectionPublic['engine']
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl: boolean
  readOnly: boolean
  group: 'dev' | 'staging' | 'prod' | 'other'
  color: string
  filePath?: string
  sshEnabled: boolean
  sshHost: string
  sshPort: number
  sshUser: string
  sshPassword: string
  sshPrivateKeyPath: string
  sshLocalPort: number
} {
  return {
    id: '',
    name: '',
    engine: 'postgres',
    host: 'localhost',
    port: 5432,
    database: '',
    user: '',
    password: '',
    ssl: false,
    readOnly: false,
    group: 'other',
    color: '',
    sshEnabled: false,
    sshHost: '',
    sshPort: 22,
    sshUser: '',
    sshPassword: '',
    sshPrivateKeyPath: '',
    sshLocalPort: 0
  }
}

export function formFromConnection(c: DbConnectionPublic) {
  return {
    id: c.id,
    name: c.name,
    engine: c.engine,
    host: c.host || 'localhost',
    port:
      c.port ??
      (c.engine === 'mysql'
        ? 3306
        : c.engine === 'redis'
          ? 6379
          : c.engine === 'mongodb'
            ? 27017
            : 5432),
    database: c.database || '',
    user: c.user || '',
    password: '',
    ssl: !!c.ssl,
    readOnly: !!c.readOnly,
    group: c.group || 'other',
    color: c.color || '',
    filePath: c.filePath,
    sshEnabled: !!c.sshEnabled,
    sshHost: c.sshHost || '',
    sshPort: c.sshPort ?? 22,
    sshUser: c.sshUser || '',
    sshPassword: '',
    sshPrivateKeyPath: c.sshPrivateKeyPath || '',
    sshLocalPort: c.sshLocalPort ?? 0
  }
}

export const CONN_GROUP_LABEL: Record<
  NonNullable<DbConnectionPublic['group']>,
  string
> = {
  dev: 'Dev',
  staging: 'Staging',
  prod: 'Prod',
  other: 'Other'
}

export const CONN_GROUP_COLORS: Record<
  NonNullable<DbConnectionPublic['group']>,
  string
> = {
  dev: '#22c55e',
  staging: '#f59e0b',
  prod: '#ef4444',
  other: '#6366f1'
}

function downloadBlob(body: string, filename: string, mime: string): void {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(
  columns: string[],
  rows: unknown[][],
  filename: string
): void {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const body = [
    columns.map(esc).join(','),
    ...rows.map((r) => r.map(esc).join(','))
  ].join('\n')
  downloadBlob(body, filename, 'text/csv;charset=utf-8')
}

export function downloadJson(
  columns: string[],
  rows: unknown[][],
  filename: string
): void {
  const docs = rows.map((row) =>
    Object.fromEntries(columns.map((c, i) => [c, row[i] ?? null]))
  )
  downloadBlob(
    JSON.stringify(docs, null, 2),
    filename,
    'application/json;charset=utf-8'
  )
}

export function downloadSqlInsert(
  table: string,
  columns: string[],
  rows: unknown[][],
  filename: string
): void {
  const lit = (v: unknown) => {
    if (v == null) return 'NULL'
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    return `'${String(v).replace(/'/g, "''")}'`
  }
  const colList = columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ')
  const lines = rows.map((row) => {
    const vals = columns.map((_, i) => lit(row[i])).join(', ')
    return `INSERT INTO "${table.replace(/"/g, '""')}" (${colList}) VALUES (${vals});`
  })
  downloadBlob(lines.join('\n') + '\n', filename, 'text/sql;charset=utf-8')
}

/** Very light SQL pretty-print for toolbar Format. */
export function formatSqlLite(sql: string): string {
  return sql
    .replace(/\s+/g, ' ')
    .replace(
      /\b(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|GROUP BY|ORDER BY|LIMIT|OFFSET|INSERT|UPDATE|DELETE|SET|VALUES|AND|OR)\b/gi,
      '\n$1'
    )
    .replace(/^\n/, '')
    .trim()
}
