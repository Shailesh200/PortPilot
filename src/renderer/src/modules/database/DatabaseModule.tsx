import { useCallback, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type {
  DatabaseScreen,
  DbConnectionInput,
  DbConnectionPublic,
  DbQueryHistoryItem
} from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { useHandoffStore } from '../../stores/handoffStore'
import { ModuleFrame } from '../../shell/ModuleFrame'
import { ToolButton, monoArea } from '../text/tools/toolUi'

const tabs: { id: DatabaseScreen; label: string }[] = [
  { id: 'connections', label: 'Connections' },
  { id: 'tables', label: 'Tables' },
  { id: 'sql', label: 'SQL' },
  { id: 'query-history', label: 'History' }
]

export function DatabaseModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const addToast = useUIStore((s) => s.addToast)
  const navigateWithPayload = useHandoffStore((s) => s.navigateWithPayload)
  const screen = nav.module === 'database' ? nav.screen : 'connections'
  const activeId =
    nav.module === 'database' ? nav.connectionId : undefined

  const [connections, setConnections] = useState<DbConnectionPublic[]>([])
  const [form, setForm] = useState<DbConnectionInput>({
    id: '',
    name: '',
    engine: 'postgres',
    host: 'localhost',
    port: 5432,
    database: '',
    user: '',
    password: '',
    ssl: false
  })
  const [tables, setTables] = useState<string[]>([])
  const [sql, setSql] = useState('select 1')
  const [result, setResult] = useState<{
    columns?: string[]
    rows?: unknown[][]
    durationMs?: number
    error?: string
  } | null>(null)
  const [history, setHistory] = useState<DbQueryHistoryItem[]>([])

  const reload = useCallback(async () => {
    setConnections(await window.api.dbListConnections())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!activeId) return
    void window.api.dbTables(activeId).then((r) => {
      if (r.ok) setTables(r.tables || [])
    })
    void window.api.dbHistory(activeId).then(setHistory)
  }, [activeId, screen])

  const selectConn = (id: string) => {
    setNav({ module: 'database', screen, connectionId: id }, false)
  }

  return (
    <ModuleFrame
      title="Database"
      subtitle={
        activeId
          ? connections.find((c) => c.id === activeId)?.name || activeId
          : 'No connection selected'
      }
      toolbar={
        <ToolButton
          onClick={async () => {
            if (!activeId) return
            const r = await window.api.dbConnect(activeId)
            addToast({
              type: r.ok ? 'success' : 'error',
              title: r.ok ? 'Connected' : 'Connect failed',
              message: r.error
            })
          }}
        >
          Connect
        </ToolButton>
      }
    >
      <div className="h-full flex flex-col min-h-0">
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border-subtle">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                setNav(
                  {
                    module: 'database',
                    screen: t.id,
                    connectionId: activeId
                  },
                  false
                )
              }
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium',
                screen === t.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-bg-hover'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {screen === 'connections' && (
          <div className="flex-1 grid grid-cols-2 gap-4 p-4 min-h-0 overflow-auto">
            <div className="space-y-1">
              {connections.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConn(c.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-lg border text-sm',
                    activeId === c.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border-subtle hover:bg-bg-hover'
                  )}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-[10px] text-text-muted uppercase">
                    {c.engine}
                    {c.host ? ` · ${c.host}` : ''}
                    {c.filePath ? ` · ${c.filePath}` : ''}
                  </div>
                </button>
              ))}
              {connections.length === 0 && (
                <p className="text-xs text-text-muted">No saved connections</p>
              )}
            </div>
            <div className="space-y-2 border border-border-subtle rounded-xl p-4 bg-bg-card">
              <p className="text-xs font-semibold text-text-muted uppercase">
                {form.id ? 'Edit' : 'New'} connection
              </p>
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
              />
              <select
                value={form.engine}
                onChange={(e) =>
                  setForm({
                    ...form,
                    engine: e.target.value as DbConnectionInput['engine']
                  })
                }
                className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
              >
                <option value="postgres">Postgres</option>
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
                <option value="redis">Redis</option>
              </select>
              {form.engine === 'sqlite' ? (
                <div className="flex gap-2">
                  <input
                    placeholder="File path"
                    value={form.filePath || ''}
                    onChange={(e) =>
                      setForm({ ...form, filePath: e.target.value })
                    }
                    className="flex-1 bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs font-mono"
                  />
                  <ToolButton
                    onClick={async () => {
                      const p = await window.api.dbPickSqliteFile()
                      if (p) setForm({ ...form, filePath: p })
                    }}
                  >
                    Browse
                  </ToolButton>
                </div>
              ) : (
                <>
                  <input
                    placeholder="Host"
                    value={form.host || ''}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Port"
                    value={form.port || ''}
                    onChange={(e) =>
                      setForm({ ...form, port: Number(e.target.value) })
                    }
                    className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
                  />
                  <input
                    placeholder="Database"
                    value={form.database || ''}
                    onChange={(e) =>
                      setForm({ ...form, database: e.target.value })
                    }
                    className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
                  />
                  <input
                    placeholder="User"
                    value={form.user || ''}
                    onChange={(e) => setForm({ ...form, user: e.target.value })}
                    className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={form.password || ''}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
                  />
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={!!form.ssl}
                      onChange={(e) =>
                        setForm({ ...form, ssl: e.target.checked })
                      }
                    />
                    SSL
                  </label>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <ToolButton
                  variant="primary"
                  onClick={async () => {
                    const id = form.id || crypto.randomUUID()
                    setConnections(
                      await window.api.dbSaveConnection({ ...form, id })
                    )
                    setForm({
                      id: '',
                      name: '',
                      engine: 'postgres',
                      host: 'localhost',
                      port: 5432,
                      database: '',
                      user: '',
                      password: '',
                      ssl: false
                    })
                    selectConn(id)
                  }}
                >
                  Save
                </ToolButton>
                {activeId && (
                  <ToolButton
                    variant="danger"
                    onClick={async () => {
                      setConnections(
                        await window.api.dbDeleteConnection(activeId)
                      )
                      setNav(
                        { module: 'database', screen: 'connections' },
                        false
                      )
                    }}
                  >
                    Delete
                  </ToolButton>
                )}
              </div>
            </div>
          </div>
        )}

        {screen === 'tables' && (
          <div className="p-4 overflow-y-auto space-y-1">
            {!activeId && (
              <p className="text-xs text-text-muted">Select a connection first</p>
            )}
            {tables.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSql(`select * from ${t} limit 100`)
                  setNav(
                    {
                      module: 'database',
                      screen: 'sql',
                      connectionId: activeId
                    },
                    false
                  )
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-mono hover:bg-bg-hover"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {screen === 'sql' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 gap-2">
            <textarea
              className={clsx(monoArea, 'h-32 border border-border-subtle rounded-xl')}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck={false}
            />
            <div className="flex gap-2">
              <ToolButton
                variant="primary"
                disabled={!activeId}
                onClick={async () => {
                  if (!activeId) return
                  const r = await window.api.dbQuery(activeId, sql)
                  setResult(r)
                  setHistory(await window.api.dbHistory(activeId))
                }}
              >
                Run
              </ToolButton>
              {result?.rows && (
                <ToolButton
                  onClick={() =>
                    navigateWithPayload(
                      { module: 'text', screen: 'json-formatter' },
                      JSON.stringify(
                        (result.rows || []).map((row) =>
                          Object.fromEntries(
                            (result.columns || []).map((c, i) => [c, row[i]])
                          )
                        ),
                        null,
                        2
                      )
                    )
                  }
                >
                  Open as JSON
                </ToolButton>
              )}
              {result?.durationMs != null && (
                <span className="text-xs text-text-muted self-center">
                  {result.durationMs}ms
                </span>
              )}
            </div>
            <div className="flex-1 overflow-auto border border-border-subtle rounded-xl">
              {result?.error ? (
                <p className="p-3 text-xs text-danger">{result.error}</p>
              ) : result?.columns ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-card">
                    <tr>
                      {result.columns.map((c) => (
                        <th
                          key={c}
                          className="text-left px-3 py-2 text-[10px] uppercase text-text-muted"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.rows || []).map((row, i) => (
                      <tr key={i} className="border-t border-border-subtle/50">
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="px-3 py-1.5 font-mono text-text-secondary"
                          >
                            {cell == null ? 'NULL' : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-3 text-xs text-text-muted">Run a query</p>
              )}
            </div>
          </div>
        )}

        {screen === 'query-history' && (
          <div className="p-4 space-y-2 overflow-y-auto">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setSql(h.sql)
                  setNav(
                    {
                      module: 'database',
                      screen: 'sql',
                      connectionId: h.connectionId
                    },
                    false
                  )
                }}
                className="w-full text-left px-3 py-2 rounded-lg border border-border-subtle hover:bg-bg-hover"
              >
                <p className="text-xs font-mono truncate">{h.sql}</p>
                <p className="text-[10px] text-text-muted mt-1">
                  {h.ok ? 'ok' : 'error'} · {h.durationMs ?? '—'}ms ·{' '}
                  {new Date(h.createdAt).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </ModuleFrame>
  )
}
