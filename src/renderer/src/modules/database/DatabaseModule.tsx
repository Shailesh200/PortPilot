import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { clsx } from 'clsx'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  KeyRound,
  Loader2,
  Lock,
  Network,
  Pencil,
  Play,
  Plus,
  Bookmark,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
  XCircle
} from 'lucide-react'
import type {
  DatabaseScreen,
  DbAccessInfo,
  DbConnectionInput,
  DbConnectionPublic,
  DbQueryHistoryItem,
  DbSavedQuery,
  DbTableSchema,
  DbTreeObject
} from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { useHandoffStore } from '../../stores/handoffStore'
import { useDatabaseSessionStore } from '../../stores/databaseSessionStore'
import { ModuleFrame } from '../../shell/ModuleFrame'
import { ToolButton, ToolSeg, ToolToggle } from '../text/tools/toolUi'
import {
  ENGINE_FULL,
  EngineBadge,
  FieldInput,
  FieldLabel,
  ResultGrid,
  StatusDot,
  CONN_GROUP_COLORS,
  CONN_GROUP_LABEL,
  connectionEndpoint,
  downloadCsv,
  downloadJson,
  downloadSqlInsert,
  emptyConnectionForm,
  formFromConnection,
  formatSqlLite,
  relativeTime
} from './dbUi'
import { SqlCodeEditor } from './SqlCodeEditor'
import { EngineIcon } from './engineIcons'
import {
  applySqlParams,
  extractSqlParams,
  parseCsv
} from './sqlParams'

const tabs: { id: DatabaseScreen; label: string }[] = [
  { id: 'connections', label: 'Connections' },
  { id: 'tables', label: 'Table Browser' },
  { id: 'sql', label: 'SQL' },
  { id: 'query-history', label: 'History' }
]

const ENGINES: DbConnectionPublic['engine'][] = [
  'postgres',
  'mysql',
  'sqlite',
  'libsql',
  'redis',
  'mongodb'
]

type QueryResult = {
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs?: number
  error?: string
}

export function DatabaseModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const addToast = useUIStore((s) => s.addToast)
  const showConfirm = useUIStore((s) => s.showConfirm)
  const navigateWithPayload = useHandoffStore((s) => s.navigateWithPayload)

  const screen = nav.module === 'database' ? nav.screen : 'connections'
  const activeId =
    nav.module === 'database' ? nav.connectionId : undefined

  const connectedIds = useDatabaseSessionStore((s) => s.connectedIds)
  const accessById = useDatabaseSessionStore((s) => s.accessById)
  const draftingNew = useDatabaseSessionStore((s) => s.draftingNew)
  const markConnected = useDatabaseSessionStore((s) => s.markConnected)
  const markDisconnected = useDatabaseSessionStore((s) => s.markDisconnected)
  const setConnectedIds = useDatabaseSessionStore((s) => s.setConnectedIds)
  const setAccess = useDatabaseSessionStore((s) => s.setAccess)
  const removeConnectionSession = useDatabaseSessionStore(
    (s) => s.removeConnection
  )
  const setDraftingNew = useDatabaseSessionStore((s) => s.setDraftingNew)
  const patchWorkspace = useDatabaseSessionStore((s) => s.patchWorkspace)

  const [connections, setConnections] = useState<DbConnectionPublic[]>([])
  const [connectionsLoaded, setConnectionsLoaded] = useState(false)
  const [connStatus, setConnStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'failed'
  >('disconnected')
  const [form, setForm] = useState(emptyConnectionForm)
  const [connQuery, setConnQuery] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showSshPassword, setShowSshPassword] = useState(false)

  const [tables, setTables] = useState<string[]>([])
  const [treeObjects, setTreeObjects] = useState<DbTreeObject[]>([])
  const [tableFilter, setTableFilter] = useState('')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [whereClause, setWhereClause] = useState('')
  const [limit, setLimit] = useState(50)
  const [tableResult, setTableResult] = useState<QueryResult | null>(null)
  const [tablePage, setTablePage] = useState(0)
  const [tableTotal, setTableTotal] = useState<number | undefined>()
  const [tableSchema, setTableSchema] = useState<DbTableSchema | null>(null)
  const [schemaOpen, setSchemaOpen] = useState(true)
  const [tableBusy, setTableBusy] = useState(false)
  const [selectedRow, setSelectedRow] = useState<number | null>(null)
  const [sqlParams, setSqlParams] = useState<Record<string, string>>({})
  const [redisPattern, setRedisPattern] = useState('*')

  const [sql, setSql] = useState('')
  const [sqlResultTabs, setSqlResultTabs] = useState<
    {
      id: string
      label: string
      sql: string
      result: QueryResult | null
    }[]
  >([])
  const [activeResultTabId, setActiveResultTabId] = useState<string | null>(
    null
  )
  const [sqlTab, setSqlTab] = useState<'results' | 'messages'>('results')
  const [sqlBusy, setSqlBusy] = useState(false)
  const [savedQueries, setSavedQueries] = useState<DbSavedQuery[]>([])
  const [saveLabel, setSaveLabel] = useState('')

  const activeSqlResult =
    sqlResultTabs.find((t) => t.id === activeResultTabId)?.result ?? null

  const pushSqlResult = (query: string, result: QueryResult) => {
    const id = crypto.randomUUID()
    const label = query.trim().slice(0, 36).replace(/\s+/g, ' ') || 'Result'
    setSqlResultTabs((prev) =>
      [{ id, label, sql: query, result }, ...prev].slice(0, 8)
    )
    setActiveResultTabId(id)
  }

  const [history, setHistory] = useState<DbQueryHistoryItem[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'ok' | 'fail'>(
    'all'
  )
  const [historyQuery, setHistoryQuery] = useState('')
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(
    null
  )

  const activeConn = connections.find((c) => c.id === activeId)

  const reload = useCallback(async () => {
    setConnections(await window.api.dbListConnections())
    setConnectionsLoaded(true)
  }, [])

  const syncLiveConnections = useCallback(async () => {
    // Preload APIs only load on Electron process start — guard for stale sessions.
    if (typeof window.api.dbListLive !== 'function') return
    const ids = await window.api.dbListLive()
    setConnectedIds(ids)
    await Promise.all(
      ids.map(async (id) => {
        const r = await window.api.dbGetAccessInfo(id)
        if (r.ok && r.info) setAccess(id, r.info)
      })
    )
  }, [setConnectedIds, setAccess])

  useEffect(() => {
    void reload()
    void syncLiveConnections()
  }, [reload, syncLiveConnections])

  // Hydrate per-connection workspace when selection changes / module remounts
  useEffect(() => {
    if (!activeId) return
    const ws = useDatabaseSessionStore.getState().getWorkspace(activeId)
    setSql(ws.sql)
    setSqlResultTabs(ws.sqlResultTabs)
    setActiveResultTabId(ws.activeResultTabId)
    setSqlTab(ws.sqlTab)
    setSelectedTable(ws.selectedTable)
    setWhereClause(ws.whereClause)
    setLimit(ws.limit)
    setTablePage(ws.tablePage)
    setTableFilter(ws.tableFilter)
    setTableResult(ws.tableResult)
    setTableTotal(ws.tableTotal)
    setTableSchema(ws.tableSchema)
    setSchemaOpen(ws.schemaOpen)
    setSelectedRow(ws.selectedRow)
    setSqlParams(ws.sqlParams)
    setRedisPattern(ws.redisPattern)
    setHistoryFilter(ws.historyFilter)
    setHistoryQuery(ws.historyQuery)
    setSelectedHistoryId(ws.selectedHistoryId)
    setSaveLabel(ws.saveLabel)
  }, [activeId])

  // Persist workspace while editing so remount / connection switch keeps it
  useEffect(() => {
    if (!activeId) return
    patchWorkspace(activeId, {
      sql,
      sqlResultTabs,
      activeResultTabId,
      sqlTab,
      selectedTable,
      whereClause,
      limit,
      tablePage,
      tableFilter,
      tableResult,
      tableTotal,
      tableSchema,
      schemaOpen,
      selectedRow,
      sqlParams,
      redisPattern,
      historyFilter,
      historyQuery,
      selectedHistoryId,
      saveLabel
    })
  }, [
    activeId,
    sql,
    sqlResultTabs,
    activeResultTabId,
    sqlTab,
    selectedTable,
    whereClause,
    limit,
    tablePage,
    tableFilter,
    tableResult,
    tableTotal,
    tableSchema,
    schemaOpen,
    selectedRow,
    sqlParams,
    redisPattern,
    historyFilter,
    historyQuery,
    selectedHistoryId,
    saveLabel,
    patchWorkspace
  ])

  // Drop stale connectionId if the profile was deleted
  useEffect(() => {
    if (!connectionsLoaded || !activeId) return
    if (!connections.some((c) => c.id === activeId)) {
      setNav({ module: 'database', screen: 'connections' }, false)
    }
  }, [connectionsLoaded, connections, activeId, setNav])

  useEffect(() => {
    if (!activeId) {
      setTables([])
      setTreeObjects([])
      setHistory([])
      setSavedQueries([])
      return
    }
    void window.api.dbTables(activeId).then((r) => {
      if (r.ok) {
        setTables(r.tables || [])
        setTreeObjects(r.objects || [])
      } else {
        setTables([])
        setTreeObjects([])
      }
    })
    void window.api.dbHistory(activeId).then((items) => {
      setHistory(items)
      if (!selectedHistoryId && items[0]) setSelectedHistoryId(items[0].id)
    })
    void window.api.dbSavedQueries(activeId).then(setSavedQueries)
  }, [activeId, screen])

  useEffect(() => {
    const names = extractSqlParams(sql)
    setSqlParams((prev) => {
      const next: Record<string, string> = {}
      for (const n of names) next[n] = prev[n] ?? ''
      return next
    })
  }, [sql])

  useEffect(() => {
    if (!activeId || draftingNew) return
    const c = connections.find((x) => x.id === activeId)
    if (c && form.id !== activeId) {
      setForm(formFromConnection(c))
      setShowPassword(false)
      setShowSshPassword(false)
    }
  }, [activeId, connections, form.id, draftingNew])

  const goScreen = (id: DatabaseScreen, connectionId = activeId) => {
    setNav({ module: 'database', screen: id, connectionId }, false)
  }

  const selectConn = (id: string) => {
    const c = connections.find((x) => x.id === id)
    if (c) setForm(formFromConnection(c))
    setDraftingNew(false)
    setNav({ module: 'database', screen, connectionId: id }, false)
  }

  const startNewConnection = () => {
    setForm(emptyConnectionForm())
    setShowPassword(false)
    setShowSshPassword(false)
    setConnStatus('disconnected')
    setDraftingNew(true)
    // Keep connectionId in nav so lastDatabaseNav still restores the prior session
    setNav(
      {
        module: 'database',
        screen: 'connections',
        connectionId: activeId
      },
      false
    )
  }

  useEffect(() => {
    if (!activeId) {
      setConnStatus('disconnected')
      return
    }
    setConnStatus(connectedIds.has(activeId) ? 'connected' : 'disconnected')
  }, [activeId, connectedIds])

  const filteredConnections = useMemo(() => {
    const q = connQuery.trim().toLowerCase()
    if (!q) return connections
    return connections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.engine.includes(q) ||
        connectionEndpoint(c).toLowerCase().includes(q)
    )
  }, [connections, connQuery])

  const filteredTables = useMemo(() => {
    const q = tableFilter.trim().toLowerCase()
    if (!q) return tables
    return tables.filter((t) => t.toLowerCase().includes(q))
  }, [tables, tableFilter])

  const filteredTreeObjects = useMemo(() => {
    const q = tableFilter.trim().toLowerCase()
    if (!q) return treeObjects
    return treeObjects.filter(
      (o) =>
        o.qualified.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        (o.schema || '').toLowerCase().includes(q)
    )
  }, [treeObjects, tableFilter])

  const filteredHistory = useMemo(() => {
    let items = history
    if (historyFilter === 'ok') items = items.filter((h) => h.ok)
    if (historyFilter === 'fail') items = items.filter((h) => !h.ok)
    const q = historyQuery.trim().toLowerCase()
    if (q) items = items.filter((h) => h.sql.toLowerCase().includes(q))
    return items
  }, [history, historyFilter, historyQuery])

  const selectedHistory =
    filteredHistory.find((h) => h.id === selectedHistoryId) ||
    filteredHistory[0] ||
    null

  const refreshAccess = async (id: string) => {
    const r = await window.api.dbGetAccessInfo(id)
    if (r.ok && r.info) setAccess(id, r.info)
  }

  const connectActive = async () => {
    if (!activeId) {
      addToast({
        type: 'warning',
        title: 'No connection selected',
        message: 'Pick or save a connection first'
      })
      return
    }
    setConnStatus('connecting')
    addToast({
      type: 'info',
      title: 'Connecting…',
      message: activeConn?.name || activeId
    })
    const r = await window.api.dbConnect(activeId)
    if (r.ok) {
      markConnected(activeId)
      setConnStatus('connected')
      await refreshAccess(activeId)
      addToast({
        type: 'success',
        title: 'Connected',
        message: activeConn?.name || activeId
      })
      const tablesRes = await window.api.dbTables(activeId)
      if (tablesRes.ok) {
        setTables(tablesRes.tables || [])
        setTreeObjects(tablesRes.objects || [])
      }
    } else {
      markDisconnected(activeId)
      setConnStatus('failed')
      addToast({
        type: 'error',
        title: 'Connect failed',
        message: r.error
      })
    }
  }

  const disconnectActive = async () => {
    if (!activeId) return
    await window.api.dbDisconnect(activeId)
    markDisconnected(activeId)
    setConnStatus('disconnected')
    addToast({
      type: 'info',
      title: 'Disconnected',
      message: activeConn?.name || activeId
    })
  }

  const resolveSql = (query: string) => {
    const names = extractSqlParams(query)
    if (names.length === 0) return query
    return applySqlParams(query, sqlParams)
  }

  const runSql = async (
    query: string,
    opts?: { allowDestructive?: boolean }
  ) => {
    if (!activeId) {
      addToast({ type: 'warning', title: 'Select a connection first' })
      return null
    }
    const resolved = resolveSql(query)
    if (!opts?.allowDestructive) {
      const analysis = await window.api.dbAnalyzeSql(resolved)
      if (analysis.destructive) {
        showConfirm({
          title: 'Destructive SQL',
          message:
            'This looks destructive (DELETE without WHERE, DROP, or TRUNCATE). Run anyway?',
          variant: 'danger',
          confirmLabel: 'Run anyway',
          onConfirm: () => {
            void (async () => {
              setSqlBusy(true)
              const confirmed = await runSql(query, { allowDestructive: true })
              if (confirmed) {
                pushSqlResult(resolved, confirmed)
                setSqlTab(confirmed.ok ? 'results' : 'messages')
              }
              setSqlBusy(false)
              if (confirmed && !confirmed.ok) {
                addToast({
                  type: 'error',
                  title: 'Query failed',
                  message: confirmed.error
                })
              }
            })()
          }
        })
        return null
      }
    }
    const r = await window.api.dbQuery(activeId, resolved, {
      allowDestructive: opts?.allowDestructive
    })
    setHistory(await window.api.dbHistory(activeId))
    return r
  }

  const loadRedisKeys = async (pattern = redisPattern) => {
    if (!activeId) return
    setTableBusy(true)
    setSelectedRow(null)
    setSelectedTable(`keys:${pattern}`)
    const r = await window.api.dbRedisKeys(activeId, {
      pattern,
      count: Math.max(1, limit)
    })
    setTableResult(r)
    setTableTotal(r.rows?.length)
    setTablePage(0)
    setTableSchema(null)
    setTableBusy(false)
    if (!r.ok) {
      addToast({ type: 'error', title: 'Redis scan failed', message: r.error })
    }
  }

  const loadTableData = async (
    table: string,
    page = 0,
    whereOverride?: string
  ) => {
    if (!activeId) return
    if (activeConn?.engine === 'redis') {
      setRedisPattern(whereOverride ?? redisPattern)
      await loadRedisKeys(whereOverride ?? redisPattern)
      return
    }
    setSelectedTable(table)
    setTableBusy(true)
    setSelectedRow(null)
    setTablePage(page)
    if (whereOverride !== undefined) setWhereClause(whereOverride)
    const where =
      whereOverride !== undefined
        ? whereOverride.trim()
        : whereClause.trim()
    const pageSize = Math.max(1, limit)
    const r = await window.api.dbBrowseTable(activeId, table, {
      where: where || undefined,
      limit: pageSize,
      offset: page * pageSize
    })
    setTableResult(r)
    setTableTotal(r.total)
    setTableBusy(false)
    setHistory(await window.api.dbHistory(activeId))
    if (!r.ok) {
      addToast({ type: 'error', title: 'Query failed', message: r.error })
    }
    const schema = await window.api.dbTableSchema(activeId, table)
    if (schema.ok && schema.schema) setTableSchema(schema.schema)
    else setTableSchema(null)
  }

  const tablePages = Math.max(
    1,
    tableTotal != null
      ? Math.ceil(tableTotal / Math.max(1, limit)) || 1
      : (tableResult?.rows?.length ?? 0) >= Math.max(1, limit)
        ? tablePage + 2
        : tablePage + 1
  )
  const pagedTableRows = tableResult?.rows || []
  const tableRowOffset = tablePage * Math.max(1, limit)

  const openAsJson = (result: QueryResult | null) => {
    if (!result?.rows || !result.columns) return
    navigateWithPayload(
      { module: 'text', screen: 'json-formatter' },
      JSON.stringify(
        result.rows.map((row) =>
          Object.fromEntries(result.columns!.map((c, i) => [c, row[i]]))
        ),
        null,
        2
      )
    )
  }

  const activeAccess =
    activeId && connectedIds.has(activeId) ? accessById[activeId] : undefined

  return (
    <ModuleFrame
      variant="workspace"
      title="Database"
      subtitle={activeConn?.name || 'No connection selected'}
      leading={
        connections.length > 0 ? (
          <ToolSeg
            aria-label="Active connection"
            options={connections.map((c) => c.id)}
            value={
              activeId && connections.some((c) => c.id === activeId)
                ? activeId
                : connections[0].id
            }
            labels={Object.fromEntries(
              connections.map((c) => [c.id, c.name || c.id])
            )}
            onChange={(id) => selectConn(id)}
          />
        ) : undefined
      }
      toolbar={
        <>
          <span
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
              connStatus === 'connected' &&
                'border-success/30 bg-success/10 text-success',
              connStatus === 'connecting' &&
                'border-info/30 bg-info/10 text-info',
              connStatus === 'failed' &&
                'border-danger/30 bg-danger/10 text-danger',
              connStatus === 'disconnected' &&
                'border-border-strong bg-bg-elevated text-text-muted'
            )}
          >
            {connStatus === 'connecting' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  connStatus === 'connected' && 'bg-success',
                  connStatus === 'failed' && 'bg-danger',
                  connStatus === 'disconnected' && 'bg-text-muted'
                )}
              />
            )}
            {connStatus === 'connecting'
              ? 'Connecting…'
              : connStatus === 'connected'
                ? 'Connected'
                : connStatus === 'failed'
                  ? 'Failed'
                  : 'Disconnected'}
          </span>
          {activeAccess && connStatus === 'connected' && (
            <span
              title={[
                activeAccess.user ? `User: ${activeAccess.user}` : null,
                activeAccess.database ? `DB: ${activeAccess.database}` : null,
                ...activeAccess.details
              ]
                .filter(Boolean)
                .join('\n')}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
                activeAccess.mode === 'read-write' &&
                  'border-accent/30 bg-accent/10 text-accent',
                activeAccess.mode === 'read-only' &&
                  'border-warning/30 bg-warning/10 text-warning',
                activeAccess.mode === 'unknown' &&
                  'border-border-strong bg-bg-elevated text-text-muted'
              )}
            >
              {activeAccess.mode === 'read-only' ? (
                <Lock className="h-3 w-3" />
              ) : activeAccess.mode === 'read-write' ? (
                <Pencil className="h-3 w-3" />
              ) : null}
              {activeAccess.mode === 'read-write'
                ? 'Read / Write'
                : activeAccess.mode === 'read-only'
                  ? 'Read only'
                  : 'Access unknown'}
            </span>
          )}
          {activeConn && (
            <span className="inline-flex items-center gap-1.5">
              <EngineIcon engine={activeConn.engine} className="h-3.5 w-3.5" />
              <EngineBadge engine={activeConn.engine} />
            </span>
          )}
          {connStatus === 'connected' ? (
            <ToolButton onClick={() => void disconnectActive()}>
              Disconnect
            </ToolButton>
          ) : (
            <ToolButton
              variant="primary"
              disabled={!activeId || connStatus === 'connecting'}
              onClick={() => void connectActive()}
            >
              {connStatus === 'connecting' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Connecting
                </>
              ) : (
                'Connect'
              )}
            </ToolButton>
          )}
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-card">
        <div className="flex flex-shrink-0 items-center gap-1 border-b border-border-subtle px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goScreen(t.id)}
              className={clsx(
                'relative h-10 px-3 text-[13px] transition-colors',
                screen === t.id
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {t.label}
              {screen === t.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 py-2">
            <ToolButton onClick={startNewConnection}>
              <Plus className="h-3.5 w-3.5" />
              New
            </ToolButton>
            {screen === 'sql' && (
              <ToolButton
                variant="primary"
                disabled={!activeId || sqlBusy}
                onClick={async () => {
                  setSqlBusy(true)
                  const r = await runSql(sql)
                  if (r) {
                    pushSqlResult(sql, r)
                    setSqlTab(r.ok ? 'results' : 'messages')
                  }
                  setSqlBusy(false)
                }}
              >
                <Play className="h-3.5 w-3.5" />
                Run
              </ToolButton>
            )}
          </div>
        </div>

        {screen === 'connections' && (
          <ConnectionsScreen
            connections={filteredConnections}
            connQuery={connQuery}
            setConnQuery={setConnQuery}
            activeId={draftingNew ? undefined : activeId}
            connectedIds={connectedIds}
            accessById={accessById}
            form={form}
            setForm={setForm}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            showSshPassword={showSshPassword}
            setShowSshPassword={setShowSshPassword}
            onSelect={selectConn}
            onNew={startNewConnection}
            onSave={async () => {
              const id = form.id || crypto.randomUUID()
              const payload: DbConnectionInput = { ...form, id }
              setConnections(await window.api.dbSaveConnection(payload))
              setDraftingNew(false)
              selectConn(id)
              addToast({ type: 'success', title: 'Connection saved' })
            }}
            onDelete={async () => {
              if (!form.id) return
              const deletedId = form.id
              const remaining = connections.filter((c) => c.id !== deletedId)
              setConnections(await window.api.dbDeleteConnection(deletedId))
              removeConnectionSession(deletedId)
              setDraftingNew(false)
              if (remaining[0]) {
                selectConn(remaining[0].id)
              } else {
                setForm(emptyConnectionForm())
                setNav({ module: 'database', screen: 'connections' }, false)
              }
              addToast({ type: 'success', title: 'Connection deleted' })
            }}
            onTest={async () => {
              const id = form.id || crypto.randomUUID()
              const payload: DbConnectionInput = { ...form, id }
              setConnections(await window.api.dbSaveConnection(payload))
              if (!form.id) {
                setForm({ ...form, id })
                selectConn(id)
              }
              setConnStatus('connecting')
              addToast({
                type: 'info',
                title: 'Connecting…',
                message: form.name || id
              })
              const r = await window.api.dbConnect(id)
              if (r.ok) {
                markConnected(id)
                setConnStatus('connected')
                await refreshAccess(id)
                addToast({
                  type: 'success',
                  title: 'Connected',
                  message: form.name || id
                })
              } else {
                setConnStatus('failed')
                addToast({
                  type: 'error',
                  title: 'Connect failed',
                  message: r.error
                })
              }
            }}
            onBrowseSqlite={async () => {
              const p = await window.api.dbPickSqliteFile()
              if (p) setForm({ ...form, filePath: p })
            }}
            onBrowseSshKey={async () => {
              const p = await window.api.dbPickSshKey()
              if (p) setForm({ ...form, sshPrivateKeyPath: p })
            }}
          />
        )}

        {screen === 'tables' && (
          <TableBrowserScreen
            activeConn={activeConn}
            connected={!!(activeId && connectedIds.has(activeId))}
            tables={filteredTables}
            treeObjects={filteredTreeObjects}
            tableFilter={tableFilter}
            setTableFilter={setTableFilter}
            selectedTable={selectedTable}
            whereClause={whereClause}
            setWhereClause={setWhereClause}
            redisPattern={redisPattern}
            setRedisPattern={setRedisPattern}
            limit={limit}
            setLimit={setLimit}
            result={tableResult}
            busy={tableBusy}
            page={tablePage}
            pages={tablePages}
            total={tableTotal}
            pagedRows={pagedTableRows}
            rowOffset={tableRowOffset}
            schema={tableSchema}
            schemaOpen={schemaOpen}
            setSchemaOpen={setSchemaOpen}
            selectedRow={selectedRow}
            setSelectedRow={setSelectedRow}
            onSelectTable={(t) => void loadTableData(t, 0)}
            onRefresh={() => {
              if (activeConn?.engine === 'redis') {
                void loadRedisKeys(redisPattern)
              } else if (selectedTable) {
                void loadTableData(selectedTable, tablePage)
              }
            }}
            onPrev={() => {
              if (!selectedTable || tablePage <= 0) return
              void loadTableData(selectedTable, tablePage - 1)
            }}
            onNext={() => {
              if (!selectedTable || tablePage >= tablePages - 1) return
              void loadTableData(selectedTable, tablePage + 1)
            }}
            onScanRedis={() => void loadRedisKeys(redisPattern)}
            onOpenRedisKey={async (key) => {
              if (!activeId) return
              setTableBusy(true)
              const r = await window.api.dbRedisKey(activeId, key)
              setTableResult(r)
              setSelectedTable(`key:${key}`)
              setTableBusy(false)
            }}
            onImportCsv={async (text) => {
              if (!activeId || !selectedTable) return
              const parsed = parseCsv(text)
              if (!parsed.columns.length) {
                addToast({ type: 'warning', title: 'Empty CSV' })
                return
              }
              const r = await window.api.dbImportCsv(activeId, {
                table: selectedTable,
                columns: parsed.columns,
                rows: parsed.rows
              })
              if (!r.ok) {
                addToast({
                  type: 'error',
                  title: 'Import failed',
                  message: r.error
                })
                return
              }
              addToast({
                type: 'success',
                title: 'CSV imported',
                message: `${r.inserted} rows · ${r.durationMs}ms`
              })
              void loadTableData(selectedTable, 0)
            }}
            onExport={(fmt) => {
              if (!tableResult?.columns || !tableResult.rows || !selectedTable)
                return
              const base = selectedTable
              if (fmt === 'csv')
                downloadCsv(
                  tableResult.columns,
                  tableResult.rows,
                  `${base}.csv`
                )
              else if (fmt === 'json')
                downloadJson(
                  tableResult.columns,
                  tableResult.rows,
                  `${base}.json`
                )
              else
                downloadSqlInsert(
                  base,
                  tableResult.columns,
                  tableResult.rows,
                  `${base}.sql`
                )
            }}
            onShowDdl={async () => {
              if (!activeId || !selectedTable) return
              const r = await window.api.dbTableDdl(activeId, selectedTable)
              if (!r.ok || !r.ddl) {
                addToast({
                  type: 'error',
                  title: 'DDL unavailable',
                  message: r.error
                })
                return
              }
              setSql(r.ddl)
              goScreen('sql', activeId)
              addToast({ type: 'success', title: 'DDL opened in SQL editor' })
            }}
            onFollowFkValue={(fk, value, openOnly) => {
              if (openOnly) {
                void loadTableData(fk.refTable, 0, '')
                return
              }
              const where =
                value == null
                  ? `${fk.refColumn} IS NULL`
                  : typeof value === 'number'
                    ? `${fk.refColumn} = ${value}`
                    : `${fk.refColumn} = '${String(value).replace(/'/g, "''")}'`
              void loadTableData(fk.refTable, 0, where)
            }}
            onCellCommit={async (rowIndex, colIndex, value) => {
              if (!activeId || !selectedTable || !tableSchema || !tableResult)
                return
              const pk = tableSchema.columns.find((c) => c.isPrimaryKey)
              if (!pk) {
                addToast({
                  type: 'warning',
                  title: 'No primary key',
                  message: 'Cell edit needs a PK column'
                })
                return
              }
              if (activeConn?.readOnly) {
                addToast({
                  type: 'warning',
                  title: 'Read-only connection'
                })
                return
              }
              const col = tableResult.columns?.[colIndex]
              const row = tableResult.rows?.[rowIndex]
              if (!col || !row) return
              const pkIdx = tableResult.columns!.indexOf(pk.name)
              if (pkIdx < 0) return
              const r = await window.api.dbUpdateCell(activeId, {
                table: selectedTable,
                pkColumn: pk.name,
                pkValue: row[pkIdx],
                column: col,
                value: value === '' ? null : value
              })
              if (!r.ok) {
                addToast({
                  type: 'error',
                  title: 'Update failed',
                  message: r.error
                })
                return
              }
              addToast({ type: 'success', title: 'Cell updated' })
              void loadTableData(selectedTable, tablePage)
            }}
            onInsertRow={async () => {
              if (!activeId || !selectedTable) return
              if (activeConn?.readOnly) {
                addToast({ type: 'warning', title: 'Read-only connection' })
                return
              }
              const r = await window.api.dbInsertRow(activeId, {
                table: selectedTable,
                columns: [],
                values: []
              })
              if (!r.ok) {
                addToast({
                  type: 'error',
                  title: 'Insert failed',
                  message: r.error
                })
                return
              }
              addToast({
                type: 'success',
                title: 'Row inserted',
                message: 'Default/empty row — edit cells to fill values'
              })
              void loadTableData(selectedTable, 0)
            }}
            canEdit={
              !!activeConn &&
              !activeConn.readOnly &&
              activeConn.engine !== 'redis' &&
              activeConn.engine !== 'mongodb'
            }
            onNeedConnection={() => goScreen('connections')}
          />
        )}

        {screen === 'sql' && (
          <SqlEditorScreen
            sql={sql}
            setSql={setSql}
            result={activeSqlResult}
            resultTabs={sqlResultTabs}
            activeResultTabId={activeResultTabId}
            onSelectResultTab={setActiveResultTabId}
            onCloseResultTab={(id) => {
              setSqlResultTabs((prev) => {
                const next = prev.filter((t) => t.id !== id)
                if (activeResultTabId === id) {
                  setActiveResultTabId(next[0]?.id ?? null)
                }
                return next
              })
            }}
            tab={sqlTab}
            setTab={setSqlTab}
            busy={sqlBusy}
            canRun={!!activeId}
            engine={activeConn?.engine}
            savedQueries={savedQueries}
            saveLabel={saveLabel}
            setSaveLabel={setSaveLabel}
            sqlParams={sqlParams}
            setSqlParam={(name, value) =>
              setSqlParams((prev) => ({ ...prev, [name]: value }))
            }
            onRun={async (query) => {
              const q = (query ?? sql).trim()
              if (!q) return
              setSqlBusy(true)
              const r = await runSql(q)
              if (r) {
                pushSqlResult(q, r)
                setSqlTab(r.ok ? 'results' : 'messages')
                if (!r.ok) {
                  addToast({
                    type: 'error',
                    title: 'Query failed',
                    message: r.error
                  })
                }
              }
              setSqlBusy(false)
            }}
            onExplain={async (analyze) => {
              if (!activeId) return
              setSqlBusy(true)
              const r = await window.api.dbExplain(activeId, sql, analyze)
              pushSqlResult(analyze ? `ANALYZE: ${sql}` : `EXPLAIN: ${sql}`, r)
              setSqlTab(r.ok ? 'results' : 'messages')
              setHistory(await window.api.dbHistory(activeId))
              setSqlBusy(false)
              if (!r.ok) {
                addToast({
                  type: 'error',
                  title: 'Explain failed',
                  message: r.error
                })
              }
            }}
            onSaveQuery={async () => {
              if (!activeId || !sql.trim()) return
              const label =
                saveLabel.trim() ||
                sql.trim().slice(0, 48).replace(/\s+/g, ' ')
              setSavedQueries(
                await window.api.dbSaveQuery({
                  connectionId: activeId,
                  label,
                  sql
                })
              )
              setSaveLabel('')
              addToast({ type: 'success', title: 'Query saved' })
            }}
            onLoadSaved={(q) => setSql(q.sql)}
            onDeleteSaved={async (id) => {
              setSavedQueries(await window.api.dbDeleteSavedQuery(id))
            }}
            onFormat={() => setSql(formatSqlLite(sql))}
            onClear={() => {
              setSql('')
            }}
            onOpenJson={() => openAsJson(activeSqlResult)}
          />
        )}

        {screen === 'query-history' && (
          <HistoryScreen
            items={filteredHistory}
            filter={historyFilter}
            setFilter={setHistoryFilter}
            query={historyQuery}
            setQuery={setHistoryQuery}
            selected={selectedHistory}
            onSelect={(id) => setSelectedHistoryId(id)}
            activeConn={activeConn}
            onCopy={async (text) => {
              await window.api.clipboardWrite(text)
              addToast({ type: 'success', title: 'Copied' })
            }}
            onOpenEditor={(item) => {
              setSql(item.sql)
              goScreen('sql', item.connectionId)
            }}
            onRerun={async (item) => {
              setSql(item.sql)
              goScreen('sql', item.connectionId)
              setSqlBusy(true)
              const r = await runSql(item.sql)
              if (r) {
                pushSqlResult(item.sql, r)
                setSqlTab(r.ok ? 'results' : 'messages')
              }
              setSqlBusy(false)
            }}
          />
        )}
      </div>
    </ModuleFrame>
  )
}

function ConnectionsScreen({
  connections,
  connQuery,
  setConnQuery,
  activeId,
  connectedIds,
  accessById,
  form,
  setForm,
  showPassword,
  setShowPassword,
  showSshPassword,
  setShowSshPassword,
  onSelect,
  onNew,
  onSave,
  onDelete,
  onTest,
  onBrowseSqlite,
  onBrowseSshKey
}: {
  connections: DbConnectionPublic[]
  connQuery: string
  setConnQuery: (v: string) => void
  activeId?: string
  connectedIds: Set<string>
  accessById: Record<string, DbAccessInfo>
  form: ReturnType<typeof emptyConnectionForm>
  setForm: (f: ReturnType<typeof emptyConnectionForm>) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  showSshPassword: boolean
  setShowSshPassword: (v: boolean) => void
  onSelect: (id: string) => void
  onNew: () => void
  onSave: () => void
  onDelete: () => void
  onTest: () => void
  onBrowseSqlite: () => void
  onBrowseSshKey: () => void
}) {
  const editing = !!form.id

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <section className="flex w-[320px] flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface">
        <div className="flex flex-col gap-3 border-b border-border-subtle p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-text-primary">
              Connections
            </h2>
            <button
              type="button"
              title="New connection"
              onClick={onNew}
              className="rounded-md border border-border-strong bg-bg-elevated p-1 text-accent hover:border-accent/50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              value={connQuery}
              onChange={(e) => setConnQuery(e.target.value)}
              placeholder="Search connections…"
              className="w-full rounded-full border border-border-strong bg-bg-elevated py-1.5 pl-9 pr-3 text-[12px] outline-none placeholder:text-text-muted/50 focus:border-accent"
            />
          </div>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {connections.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-text-muted">
              No saved connections
            </p>
          ) : (
            connections.map((c) => {
              const selected = activeId === c.id && editing
              const connected = connectedIds.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={clsx(
                    'group flex w-full items-center gap-3 rounded-lg border-l-2 p-2 text-left transition-colors',
                    selected
                      ? 'border-l-accent bg-accent/10'
                      : 'border-l-transparent hover:bg-bg-card'
                  )}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border-strong bg-bg-card"
                      style={{
                        boxShadow: `inset 3px 0 0 ${
                          c.color ||
                          CONN_GROUP_COLORS[c.group || 'other']
                        }`
                      }}
                    >
                      <EngineIcon
                        engine={c.engine}
                        className="h-4 w-4"
                        title={ENGINE_FULL[c.engine]}
                      />
                    </div>
                    <StatusDot tone={connected ? 'connected' : 'idle'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-text-primary">
                        {c.name}
                      </span>
                      {c.group && c.group !== 'other' && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                          style={{
                            color:
                              c.color || CONN_GROUP_COLORS[c.group],
                            backgroundColor: `${
                              c.color || CONN_GROUP_COLORS[c.group]
                            }22`
                          }}
                        >
                          {CONN_GROUP_LABEL[c.group]}
                        </span>
                      )}
                      <EngineBadge engine={c.engine} />
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-text-muted">
                      {c.sshEnabled ? 'SSH · ' : ''}
                      {connectionEndpoint(c)}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border-subtle p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border-strong bg-bg-elevated">
                <EngineIcon
                  engine={form.engine}
                  className="h-5 w-5"
                  title={ENGINE_FULL[form.engine]}
                />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-text-primary">
                  {form.name || (editing ? 'Untitled' : 'New connection')}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                  {editing && activeId && connectedIds.has(activeId) ? (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        Connected
                      </span>
                      {accessById[activeId] && (
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
                            accessById[activeId].mode === 'read-write' &&
                              'border-accent/30 text-accent',
                            accessById[activeId].mode === 'read-only' &&
                              'border-warning/30 text-warning',
                            accessById[activeId].mode === 'unknown' &&
                              'border-border-strong text-text-muted'
                          )}
                        >
                          {accessById[activeId].mode === 'read-write'
                            ? 'Read / Write'
                            : accessById[activeId].mode === 'read-only'
                              ? 'Read only'
                              : 'Access unknown'}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-text-muted" />
                      {editing ? 'Not connected' : 'Draft'}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <FieldLabel>Database Engine</FieldLabel>
                {editing ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2">
                    <EngineIcon
                      engine={form.engine}
                      className="h-4 w-4"
                      title={ENGINE_FULL[form.engine]}
                    />
                    <span className="text-[13px] font-medium text-text-primary">
                      {ENGINE_FULL[form.engine]}
                    </span>
                    <EngineBadge engine={form.engine} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-subtle bg-bg p-1 sm:grid-cols-3">
                    {ENGINES.map((eng) => (
                      <button
                        key={eng}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            engine: eng,
                            port:
                              eng === 'mysql'
                                ? 3306
                                : eng === 'redis'
                                  ? 6379
                                  : eng === 'mongodb'
                                    ? 27017
                                    : eng === 'postgres'
                                      ? 5432
                                      : form.port
                          })
                        }
                        className={clsx(
                          'flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[12px] transition-all',
                          form.engine === eng
                            ? 'border border-border-strong bg-bg-elevated text-text-primary shadow-sm'
                            : 'border border-transparent text-text-muted hover:bg-bg-elevated hover:text-text-primary'
                        )}
                      >
                        <EngineIcon engine={eng} className="h-3.5 w-3.5" />
                        <span className="truncate">{ENGINE_FULL[eng]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Connection Name</FieldLabel>
                  <FieldInput
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="My database"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Environment</FieldLabel>
                  <div className="flex gap-1 rounded-lg border border-border-subtle bg-bg p-1">
                    {(
                      ['dev', 'staging', 'prod', 'other'] as const
                    ).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            group: g,
                            color: form.color || CONN_GROUP_COLORS[g]
                          })
                        }
                        className={clsx(
                          'flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                          form.group === g
                            ? 'border border-border-strong bg-bg-elevated text-text-primary shadow-sm'
                            : 'border border-transparent text-text-muted hover:bg-bg-elevated'
                        )}
                      >
                        {CONN_GROUP_LABEL[g]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Accent color</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        form.color ||
                        CONN_GROUP_COLORS[form.group || 'other']
                      }
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                      className="h-9 w-12 cursor-pointer rounded border border-border-strong bg-bg-elevated"
                    />
                    <FieldInput
                      mono
                      className="flex-1"
                      value={form.color}
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                      placeholder={CONN_GROUP_COLORS[form.group || 'other']}
                    />
                  </div>
                </div>

                {form.engine === 'sqlite' ? (
                  <div className="space-y-2 md:col-span-2">
                    <FieldLabel>File path</FieldLabel>
                    <div className="flex gap-2">
                      <FieldInput
                        mono
                        className="flex-1"
                        value={form.filePath || ''}
                        onChange={(e) =>
                          setForm({ ...form, filePath: e.target.value })
                        }
                        placeholder="/path/to/db.sqlite"
                      />
                      <ToolButton onClick={onBrowseSqlite}>
                        <FolderOpen className="h-3.5 w-3.5" />
                        Browse
                      </ToolButton>
                    </div>
                  </div>
                ) : form.engine === 'libsql' ? (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>Database URL</FieldLabel>
                      <FieldInput
                        mono
                        value={form.host}
                        onChange={(e) =>
                          setForm({ ...form, host: e.target.value })
                        }
                        placeholder="libsql://….turso.io"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>Auth Token</FieldLabel>
                      <div className="relative">
                        <FieldInput
                          mono
                          type={showPassword ? 'text' : 'password'}
                          className="pr-10"
                          value={form.password}
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                          placeholder={
                            editing ? '•••••••• (paste to replace)' : 'eyJ…'
                          }
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="md:col-span-2 text-[11px] text-text-muted">
                      Paste the remote <code className="text-accent">libsql://</code> URL and
                      auth token (from your host dashboard or deploy env). Leave token blank on
                      Save to keep the stored secret.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <FieldLabel>
                        {form.engine === 'mongodb'
                          ? 'Host / Mongo URI'
                          : 'Host / Server'}
                      </FieldLabel>
                      <FieldInput
                        mono
                        value={form.host}
                        onChange={(e) =>
                          setForm({ ...form, host: e.target.value })
                        }
                        placeholder={
                          form.engine === 'mongodb'
                            ? 'localhost or mongodb://… / mongodb+srv://…'
                            : form.engine === 'postgres'
                              ? 'localhost (or paste postgresql://… URL)'
                              : 'localhost'
                        }
                      />
                      {form.engine === 'postgres' &&
                        /^(postgres(ql)?:\/\/|postgres$)/i.test(
                          form.host.trim()
                        ) && (
                          <p className="text-[11px] text-warning">
                            Coolify URLs often use host <code>postgres</code>{' '}
                            (Docker-only). From your Mac, SSH-tunnel to the
                            server, then use <code>localhost</code> — or paste
                            the full URL and we&apos;ll parse it (still needs a
                            reachable host).
                          </p>
                        )}
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Port</FieldLabel>
                      <FieldInput
                        mono
                        type="number"
                        value={form.port}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            port: Number(e.target.value) || 0
                          })
                        }
                        disabled={/^mongodb\+srv:\/\//i.test(form.host)}
                      />
                    </div>
                    {form.engine !== 'redis' && (
                      <div className="space-y-2 md:col-span-2">
                        <FieldLabel>Database Name</FieldLabel>
                        <FieldInput
                          mono
                          value={form.database}
                          onChange={(e) =>
                            setForm({ ...form, database: e.target.value })
                          }
                          placeholder={
                            form.engine === 'mongodb' ? 'test' : undefined
                          }
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <FieldLabel>Username</FieldLabel>
                      <FieldInput
                        mono
                        value={form.user}
                        onChange={(e) =>
                          setForm({ ...form, user: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Password</FieldLabel>
                      <div className="relative">
                        <FieldInput
                          mono
                          type={showPassword ? 'text' : 'password'}
                          className="pr-10"
                          value={form.password}
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                          placeholder={editing ? '••••••••' : ''}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {form.engine === 'mongodb' && (
                      <p className="md:col-span-2 text-[11px] text-text-muted">
                        Queries:{' '}
                        <code className="text-accent">show collections</code>,{' '}
                        <code className="text-accent">
                          db.users.find({`{}`}).limit(50)
                        </code>
                        , or paste a full{' '}
                        <code className="text-accent">mongodb://</code> /{' '}
                        <code className="text-accent">mongodb+srv://</code> URI
                        in Host.
                      </p>
                    )}
                  </>
                )}
              </div>

              {form.engine !== 'sqlite' && form.engine !== 'libsql' && (
                <div className="space-y-3 border-t border-border-subtle pt-4">
                  <ToolToggle
                    label="Require SSL/TLS"
                    checked={!!form.ssl}
                    onChange={(v) => setForm({ ...form, ssl: v })}
                  />
                  <ToolToggle
                    label="Read-only mode"
                    checked={!!form.readOnly}
                    onChange={(v) => setForm({ ...form, readOnly: v })}
                  />
                  <ToolToggle
                    label="Use SSH Tunnel"
                    checked={!!form.sshEnabled}
                    onChange={(v) => setForm({ ...form, sshEnabled: v })}
                  />
                  {form.sshEnabled && (
                    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border-subtle bg-bg-elevated/50 p-3 md:grid-cols-2">
                      <p className="md:col-span-2 text-[11px] text-text-muted">
                        Leave Host as the DB hostname seen from the SSH server
                        (e.g. <code className="text-accent">postgres</code>
                        ). PortPilot opens a local forward automatically.
                      </p>
                      <div className="space-y-2">
                        <FieldLabel>SSH Host</FieldLabel>
                        <FieldInput
                          mono
                          value={form.sshHost}
                          onChange={(e) =>
                            setForm({ ...form, sshHost: e.target.value })
                          }
                          placeholder="bastion.example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>SSH Port</FieldLabel>
                        <FieldInput
                          mono
                          type="number"
                          value={form.sshPort}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              sshPort: Number(e.target.value) || 22
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>SSH User</FieldLabel>
                        <FieldInput
                          mono
                          value={form.sshUser}
                          onChange={(e) =>
                            setForm({ ...form, sshUser: e.target.value })
                          }
                          placeholder="root"
                        />
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Local bind port (0 = auto)</FieldLabel>
                        <FieldInput
                          mono
                          type="number"
                          value={form.sshLocalPort}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              sshLocalPort: Number(e.target.value) || 0
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <FieldLabel>Private key path</FieldLabel>
                        <div className="flex gap-2">
                          <FieldInput
                            mono
                            className="flex-1"
                            value={form.sshPrivateKeyPath}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                sshPrivateKeyPath: e.target.value
                              })
                            }
                            placeholder="~/.ssh/id_ed25519"
                          />
                          <ToolButton onClick={onBrowseSshKey}>
                            <KeyRound className="h-3.5 w-3.5" />
                            Browse
                          </ToolButton>
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <FieldLabel>SSH Password (if no key)</FieldLabel>
                        <div className="relative">
                          <FieldInput
                            mono
                            type={showSshPassword ? 'text' : 'password'}
                            className="pr-10"
                            value={form.sshPassword}
                            onChange={(e) =>
                              setForm({ ...form, sshPassword: e.target.value })
                            }
                            placeholder={
                              editing ? '•••••••• (leave blank to keep)' : ''
                            }
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                            onClick={() => setShowSshPassword(!showSshPassword)}
                          >
                            {showSshPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(form.engine === 'sqlite' || form.engine === 'libsql') && (
                <div className="space-y-3 border-t border-border-subtle pt-4">
                  <ToolToggle
                    label="Read-only mode"
                    checked={!!form.readOnly}
                    onChange={(v) => setForm({ ...form, readOnly: v })}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center justify-between rounded-b-xl border-t border-border-subtle bg-bg-surface p-3">
            <ToolButton
              variant="danger"
              disabled={!editing}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </ToolButton>
            <div className="flex gap-2">
              <ToolButton disabled={!editing} onClick={onTest}>
                Test Connection
              </ToolButton>
              <ToolButton variant="primary" onClick={onSave}>
                Save
              </ToolButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function TableBrowserScreen({
  activeConn,
  connected,
  tables,
  treeObjects,
  tableFilter,
  setTableFilter,
  selectedTable,
  whereClause,
  setWhereClause,
  redisPattern,
  setRedisPattern,
  limit,
  setLimit,
  result,
  busy,
  page,
  pages,
  total,
  pagedRows,
  rowOffset,
  schema,
  schemaOpen,
  setSchemaOpen,
  selectedRow,
  setSelectedRow,
  onSelectTable,
  onRefresh,
  onPrev,
  onNext,
  onScanRedis,
  onOpenRedisKey,
  onImportCsv,
  onExport,
  onShowDdl,
  onFollowFkValue,
  onCellCommit,
  onInsertRow,
  canEdit,
  onNeedConnection
}: {
  activeConn?: DbConnectionPublic
  connected: boolean
  tables: string[]
  treeObjects: DbTreeObject[]
  tableFilter: string
  setTableFilter: (v: string) => void
  selectedTable: string | null
  whereClause: string
  setWhereClause: (v: string) => void
  redisPattern: string
  setRedisPattern: (v: string) => void
  limit: number
  setLimit: (n: number) => void
  result: QueryResult | null
  busy: boolean
  page: number
  pages: number
  total?: number
  pagedRows: unknown[][]
  rowOffset: number
  schema: DbTableSchema | null
  schemaOpen: boolean
  setSchemaOpen: (v: boolean) => void
  selectedRow: number | null
  setSelectedRow: (n: number | null) => void
  onSelectTable: (t: string) => void
  onRefresh: () => void
  onPrev: () => void
  onNext: () => void
  onScanRedis: () => void
  onOpenRedisKey: (key: string) => void
  onImportCsv: (text: string) => void
  onExport: (fmt: 'csv' | 'json' | 'sql') => void
  onShowDdl: () => void
  onFollowFkValue: (
    fk: { column: string; refTable: string; refColumn: string },
    value: unknown,
    openOnly?: boolean
  ) => void
  onCellCommit: (rowIndex: number, colIndex: number, value: string) => void
  onInsertRow: () => void
  canEdit: boolean
  onNeedConnection: () => void
}) {
  const [treeOpen, setTreeOpen] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [openSchemas, setOpenSchemas] = useState<Record<string, boolean>>({})
  const csvInputRef = useRef<HTMLInputElement>(null)
  const isRedis = activeConn?.engine === 'redis'

  const schemaGroups = useMemo(() => {
    const map = new Map<string, DbTreeObject[]>()
    for (const o of treeObjects) {
      const s = o.schema || '(default)'
      if (!map.has(s)) map.set(s, [])
      map.get(s)!.push(o)
    }
    return Array.from(map.entries())
  }, [treeObjects])

  useEffect(() => {
    setOpenSchemas((prev) => {
      const next = { ...prev }
      for (const [s] of schemaGroups) {
        if (next[s] === undefined) next[s] = true
      }
      return next
    })
  }, [schemaGroups])

  if (!activeConn) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            Select a connection to browse tables
          </p>
          <div className="mt-3">
            <ToolButton variant="primary" onClick={onNeedConnection}>
              Open Connections
            </ToolButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface">
        <div className="flex items-center gap-2 border-b border-border-subtle p-3">
          <span
            className={clsx(
              'h-2 w-2 rounded-full',
              connected ? 'bg-accent shadow-[0_0_8px_rgba(99,102,241,0.45)]' : 'bg-text-muted'
            )}
          />
          <span className="truncate text-[13px] font-semibold text-text-primary">
            {activeConn.name}
          </span>
          {activeConn.sshEnabled && (
            <Network className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
          )}
        </div>
        <div className="p-2">
          <input
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            placeholder={
              isRedis ? 'Filter keys…' : 'Filter schemas/tables…'
            }
            className="h-7 w-full rounded-md border border-border-strong bg-bg-elevated px-2 text-[12px] outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2 font-mono text-[12px] text-text-secondary">
          {isRedis ? (
            <div className="space-y-2">
              <p className="px-1 text-[11px] text-text-muted">
                SCAN keys by pattern, then open a key for typed preview.
              </p>
              <ToolButton
                variant="primary"
                disabled={!connected || busy}
                onClick={onScanRedis}
              >
                <Search className="h-3.5 w-3.5" />
                Scan keys
              </ToolButton>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setTreeOpen((v) => !v)}
                className="flex w-full items-center gap-1 rounded px-1 py-1 hover:bg-bg-hover"
              >
                {treeOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <Database className="h-3.5 w-3.5 text-text-muted" />
                <span>{activeConn.database || 'main'}</span>
              </button>
              {treeOpen && (
                <div className="mt-0.5 space-y-0.5 pl-2">
                  {schemaGroups.length === 0 ? (
                    <p className="px-1 py-2 text-[11px] text-text-muted">
                      {connected
                        ? 'No tables found'
                        : 'Connect to load tables'}
                    </p>
                  ) : (
                    schemaGroups.map(([schemaName, objs]) => (
                      <div key={schemaName}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSchemas((prev) => ({
                              ...prev,
                              [schemaName]: !prev[schemaName]
                            }))
                          }
                          className="flex w-full items-center gap-1 rounded px-1 py-1 hover:bg-bg-hover"
                        >
                          {openSchemas[schemaName] !== false ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span className="truncate text-text-muted">
                            {schemaName}
                          </span>
                          <span className="ml-auto text-[10px] text-text-muted">
                            {objs.length}
                          </span>
                        </button>
                        {openSchemas[schemaName] !== false && (
                          <div className="space-y-0.5 pl-4">
                            {objs.map((o) => (
                              <button
                                key={o.qualified}
                                type="button"
                                onClick={() => onSelectTable(o.qualified)}
                                className={clsx(
                                  'flex w-full items-center gap-1 rounded px-1 py-1 text-left',
                                  selectedTable === o.qualified
                                    ? 'border-l-2 border-accent bg-accent/10 pl-1 text-accent'
                                    : 'ml-0.5 hover:bg-bg-hover'
                                )}
                              >
                                <Table2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{o.name}</span>
                                {o.kind === 'view' && (
                                  <span className="text-[9px] text-text-muted">
                                    view
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-accent" />
              <span className="font-mono text-[12px] font-semibold text-text-primary">
                {selectedTable || '—'}
              </span>
            </div>
            <div className="hidden h-4 w-px bg-border-strong sm:block" />
            <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
              <span className="font-mono text-[12px] text-text-muted">
                {isRedis ? 'MATCH' : 'WHERE'}
              </span>
              <input
                value={isRedis ? redisPattern : whereClause}
                onChange={(e) =>
                  isRedis
                    ? setRedisPattern(e.target.value)
                    : setWhereClause(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (isRedis) onScanRedis()
                    else if (selectedTable) onRefresh()
                  }
                }}
                placeholder={
                  isRedis
                    ? 'user:*'
                    : activeConn.engine === 'mongodb'
                      ? '{"status":"active"}'
                      : 'id > 1000…'
                }
                className="h-7 min-w-0 flex-1 rounded-md border border-border-strong bg-bg-elevated px-2 font-mono text-[12px] outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 items-center overflow-hidden rounded-md border border-border-strong bg-bg-elevated">
              <span className="border-r border-border-strong px-2 font-mono text-[11px] text-text-muted">
                {isRedis ? 'COUNT' : 'LIMIT'}
              </span>
              <input
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 50)}
                className="h-full w-16 border-none bg-transparent px-2 font-mono text-[12px] outline-none"
              />
            </div>
            <button
              type="button"
              disabled={busy || (!isRedis && !selectedTable)}
              onClick={isRedis ? onScanRedis : onRefresh}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-text-muted hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
            >
              <RefreshCw
                className={clsx('h-3.5 w-3.5', busy && 'animate-spin')}
              />
            </button>
            {canEdit && !isRedis && (
              <ToolButton disabled={!selectedTable || busy} onClick={onInsertRow}>
                <Plus className="h-3.5 w-3.5" />
                Insert
              </ToolButton>
            )}
            {canEdit && !isRedis && selectedTable && (
              <>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    void file.text().then(onImportCsv)
                    e.target.value = ''
                  }}
                />
                <ToolButton
                  disabled={busy}
                  onClick={() => csvInputRef.current?.click()}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Import CSV
                </ToolButton>
              </>
            )}
            {!isRedis && (
              <ToolButton disabled={!selectedTable} onClick={onShowDdl}>
                <FileCode2 className="h-3.5 w-3.5" />
                DDL
              </ToolButton>
            )}
            <div className="relative">
              <button
                type="button"
                disabled={!result?.rows?.length}
                onClick={() => setExportOpen((v) => !v)}
                className="flex h-7 items-center gap-1 rounded-md border border-border-strong px-2 text-[12px] text-text-secondary hover:bg-bg-hover disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-border-strong bg-bg-elevated shadow-lg">
                  {(
                    [
                      ['csv', 'CSV', FileSpreadsheet],
                      ['json', 'JSON', FileJson],
                      ['sql', 'SQL INSERT', FileCode2]
                    ] as const
                  ).map(([fmt, label, Icon]) => (
                    <button
                      key={fmt}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                      onClick={() => {
                        onExport(fmt)
                        setExportOpen(false)
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            {result?.error ? (
              <div className="flex-1 overflow-auto p-4">
                <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 font-mono text-[12px] text-danger">
                  {result.error}
                </p>
              </div>
            ) : result?.columns ? (
              <ResultGrid
                columns={result.columns}
                rows={pagedRows}
                selectedRow={selectedRow}
                onSelectRow={(i) => {
                  setSelectedRow(i)
                  if (isRedis && result.columns?.[0] === 'key') {
                    const key = pagedRows[i]?.[0]
                    if (key != null) onOpenRedisKey(String(key))
                  }
                }}
                rowOffset={rowOffset}
                editable={canEdit && !isRedis}
                onCellCommit={onCellCommit}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-[13px] text-text-muted">
                {busy ? 'Loading…' : 'Select a table to preview rows'}
              </div>
            )}

            <div className="flex h-8 flex-shrink-0 items-center justify-between border-t border-border-subtle bg-bg-surface px-3 font-mono text-[10px] text-text-muted">
              <div className="flex items-center gap-3">
                <span>
                  {total != null
                    ? `${total} total · showing ${pagedRows.length}`
                    : `${pagedRows.length} rows`}
                </span>
                <span>·</span>
                <span>
                  {result?.durationMs != null ? `${result.durationMs}ms` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 0 || busy}
                  onClick={onPrev}
                  className="hover:text-text-primary disabled:opacity-30"
                >
                  Prev
                </button>
                <span>
                  page {Math.min(page + 1, pages)}/{pages}
                </span>
                <button
                  type="button"
                  disabled={page >= pages - 1 || busy}
                  onClick={onNext}
                  className="hover:text-text-primary disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {selectedTable && (
            <aside
              className={clsx(
                'flex flex-shrink-0 flex-col border-l border-border-subtle bg-bg-surface transition-[width]',
                schemaOpen ? 'w-[280px]' : 'w-9'
              )}
            >
              <button
                type="button"
                onClick={() => setSchemaOpen(!schemaOpen)}
                className="flex h-9 items-center gap-2 border-b border-border-subtle px-2 text-[11px] font-medium uppercase tracking-wider text-text-muted hover:text-text-primary"
              >
                {schemaOpen ? (
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {schemaOpen && 'Schema'}
              </button>
              {schemaOpen && (
                <div className="flex-1 overflow-y-auto p-2 text-[11px]">
                  {!schema ? (
                    <p className="px-1 py-2 text-text-muted">No schema</p>
                  ) : (
                    <>
                      <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Columns
                      </p>
                      <div className="mb-3 space-y-0.5">
                        {schema.columns.map((c) => (
                          <div
                            key={c.name}
                            className="rounded px-1.5 py-1 hover:bg-bg-hover"
                          >
                            <div className="flex items-center gap-1 font-mono text-[12px] text-text-primary">
                              {c.isPrimaryKey && (
                                <KeyRound className="h-3 w-3 text-warning" />
                              )}
                              <span className="truncate">{c.name}</span>
                            </div>
                            <div className="pl-4 font-mono text-[10px] text-text-muted">
                              {c.type}
                              {!c.nullable ? ' · NOT NULL' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                      {schema.indexes.length > 0 && (
                        <>
                          <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            Indexes
                          </p>
                          <div className="mb-3 space-y-1">
                            {schema.indexes.map((idx) => (
                              <div
                                key={idx.name}
                                className="rounded px-1.5 py-1 font-mono text-[11px] text-text-secondary"
                              >
                                <div className="truncate text-text-primary">
                                  {idx.name}
                                  {idx.unique ? ' · UNIQUE' : ''}
                                </div>
                                <div className="text-text-muted">
                                  ({idx.columns.join(', ')})
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {schema.foreignKeys.length > 0 && (
                        <>
                          <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            Foreign keys
                          </p>
                          <div className="space-y-1">
                            {schema.foreignKeys.map((fk, i) => (
                              <button
                                key={`${fk.column}-${i}`}
                                type="button"
                                title="Jump to related table (uses selected row value when available)"
                                className="w-full rounded px-1.5 py-1 text-left font-mono text-[11px] text-accent hover:bg-bg-hover"
                                onClick={() => {
                                  const cols = result?.columns || []
                                  const row =
                                    selectedRow != null
                                      ? pagedRows[selectedRow]
                                      : undefined
                                  const idx = cols.indexOf(fk.column)
                                  if (row && idx >= 0) {
                                    onFollowFkValue(fk, row[idx])
                                  } else {
                                    onFollowFkValue(fk, null, true)
                                  }
                                }}
                              >
                                {fk.column} → {fk.refTable}.{fk.refColumn}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

function SqlEditorScreen({
  sql,
  setSql,
  result,
  resultTabs,
  activeResultTabId,
  onSelectResultTab,
  onCloseResultTab,
  tab,
  setTab,
  busy,
  canRun,
  engine,
  savedQueries,
  saveLabel,
  setSaveLabel,
  sqlParams,
  setSqlParam,
  onRun,
  onExplain,
  onSaveQuery,
  onLoadSaved,
  onDeleteSaved,
  onFormat,
  onClear,
  onOpenJson
}: {
  sql: string
  setSql: (v: string) => void
  result: QueryResult | null
  resultTabs: {
    id: string
    label: string
    sql: string
    result: QueryResult | null
  }[]
  activeResultTabId: string | null
  onSelectResultTab: (id: string) => void
  onCloseResultTab: (id: string) => void
  tab: 'results' | 'messages'
  setTab: (t: 'results' | 'messages') => void
  busy: boolean
  canRun: boolean
  engine?: DbConnectionPublic['engine']
  savedQueries: DbSavedQuery[]
  saveLabel: string
  setSaveLabel: (v: string) => void
  sqlParams: Record<string, string>
  setSqlParam: (name: string, value: string) => void
  onRun: (query?: string) => void
  onExplain: (analyze: boolean) => void
  onSaveQuery: () => void
  onLoadSaved: (q: DbSavedQuery) => void
  onDeleteSaved: (id: string) => void
  onFormat: () => void
  onClear: () => void
  onOpenJson: () => void
}) {
  const [snippetsOpen, setSnippetsOpen] = useState(true)
  const paramNames = Object.keys(sqlParams)
  const supportsExplain =
    engine === 'postgres' ||
    engine === 'mysql' ||
    engine === 'sqlite' ||
    engine === 'libsql'

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-[220px] flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
          <button
            type="button"
            onClick={() => setSnippetsOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-text-muted"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Saved
          </button>
          <span className="font-mono text-[10px] text-text-muted">
            {savedQueries.length}
          </span>
        </div>
        {snippetsOpen && (
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {savedQueries.length === 0 ? (
              <p className="px-1 py-4 text-center text-[11px] text-text-muted">
                Save named snippets for this connection
              </p>
            ) : (
              savedQueries.map((q) => (
                <div
                  key={q.id}
                  className="group rounded-md border border-transparent px-2 py-1.5 hover:border-border-subtle hover:bg-bg-hover"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onLoadSaved(q)}
                  >
                    <div className="truncate text-[12px] font-medium text-text-primary">
                      {q.label}
                    </div>
                    <div className="mt-0.5 line-clamp-2 font-mono text-[10px] text-text-muted">
                      {q.sql}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="mt-1 hidden text-[10px] text-danger group-hover:inline"
                    onClick={() => onDeleteSaved(q.id)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <section className="flex h-1/2 min-h-[160px] flex-col border-b border-border-subtle bg-bg-elevated">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/60 bg-bg-surface px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <ToolButton
                variant="primary"
                disabled={!canRun || busy}
                onClick={() => onRun()}
              >
                <Play className="h-3.5 w-3.5" />
                Run
                <span className="ml-1 font-mono text-[10px] opacity-70">⌘↵</span>
              </ToolButton>
              {supportsExplain && (
                <>
                  <ToolButton
                    disabled={!canRun || busy}
                    onClick={() => onExplain(false)}
                  >
                    Explain
                  </ToolButton>
                  <ToolButton
                    disabled={!canRun || busy}
                    onClick={() => onExplain(true)}
                  >
                    Analyze
                  </ToolButton>
                </>
              )}
              <div className="mx-1 h-4 w-px bg-border-strong" />
              <ToolButton onClick={onFormat}>Format</ToolButton>
              <ToolButton variant="danger" onClick={onClear}>
                Clear
              </ToolButton>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="Snippet name"
                className="h-7 w-32 rounded-md border border-border-strong bg-bg-elevated px-2 text-[11px] outline-none focus:border-accent"
              />
              <ToolButton disabled={!canRun || !sql.trim()} onClick={onSaveQuery}>
                <Bookmark className="h-3.5 w-3.5" />
                Save
              </ToolButton>
              <ToolButton
                disabled={!result?.rows?.length}
                onClick={onOpenJson}
              >
                Open as JSON
              </ToolButton>
            </div>
          </div>
          <SqlCodeEditor
            value={sql}
            onChange={setSql}
            onRun={(q) => onRun(q)}
            engine={engine}
          />
          {paramNames.length > 0 && (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-border-subtle bg-bg-surface px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Params
              </span>
              {paramNames.map((name) => (
                <label
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-bg-elevated px-2 py-1"
                >
                  <span className="font-mono text-[11px] text-accent">
                    :{name}
                  </span>
                  <input
                    value={sqlParams[name] ?? ''}
                    onChange={(e) => setSqlParam(name, e.target.value)}
                    placeholder="value"
                    className="w-28 bg-transparent font-mono text-[11px] outline-none"
                  />
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="flex h-1/2 min-h-0 flex-col bg-bg-surface">
          {resultTabs.length > 0 && (
            <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-border-subtle bg-bg px-2 py-1">
              {resultTabs.map((t) => (
                <div
                  key={t.id}
                  className={clsx(
                    'group flex max-w-[160px] items-center gap-1 rounded-md border px-2 py-1 text-[11px]',
                    activeResultTabId === t.id
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-transparent text-text-muted hover:bg-bg-hover'
                  )}
                >
                  <button
                    type="button"
                    className="truncate"
                    onClick={() => onSelectResultTab(t.id)}
                    title={t.sql}
                  >
                    {t.label}
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 opacity-60 hover:bg-bg-elevated hover:opacity-100"
                    onClick={() => onCloseResultTab(t.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center border-b border-border-subtle bg-bg px-3">
            <button
              type="button"
              onClick={() => setTab('results')}
              className={clsx(
                'relative flex h-9 items-center gap-1.5 px-3 text-[12px]',
                tab === 'results'
                  ? 'text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Table2 className="h-3.5 w-3.5" />
              Results
              {tab === 'results' && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-accent" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('messages')}
              className={clsx(
                'relative flex h-9 items-center gap-1.5 px-3 text-[12px]',
                tab === 'messages'
                  ? 'text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Messages
              {result && (
                <span className="rounded-full bg-bg-elevated px-1.5 text-[10px] text-text-muted">
                  1
                </span>
              )}
              {tab === 'messages' && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 bg-accent" />
              )}
            </button>
            <div className="ml-auto flex items-center gap-1.5 text-[12px] text-text-muted">
              {result?.ok ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  OK · {result.durationMs ?? '—'}ms · {result.rows?.length ?? 0}{' '}
                  rows
                </>
              ) : result?.error ? (
                <>
                  <XCircle className="h-3.5 w-3.5 text-danger" />
                  Failed · {result.durationMs ?? '—'}ms
                </>
              ) : busy ? (
                'Running…'
              ) : null}
            </div>
          </div>

          {tab === 'messages' ? (
            <div className="flex-1 overflow-auto p-3">
              {result?.error ? (
                <pre className="rounded-lg border border-danger/30 bg-danger/10 p-3 font-mono text-[12px] text-danger whitespace-pre-wrap">
                  {result.error}
                </pre>
              ) : result?.ok ? (
                <p className="text-[12px] text-success">
                  Query succeeded in {result.durationMs}ms
                  {result.rows ? ` · ${result.rows.length} rows` : ''}
                </p>
              ) : (
                <p className="text-[12px] text-text-muted">
                  Run a query to see messages
                </p>
              )}
            </div>
          ) : result?.columns ? (
            <ResultGrid
              columns={result.columns}
              rows={result.rows || []}
              className="bg-bg-card"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-text-muted">
              Run a query to see results
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function HistoryScreen({
  items,
  filter,
  setFilter,
  query,
  setQuery,
  selected,
  onSelect,
  activeConn,
  onCopy,
  onOpenEditor,
  onRerun
}: {
  items: DbQueryHistoryItem[]
  filter: 'all' | 'ok' | 'fail'
  setFilter: (f: 'all' | 'ok' | 'fail') => void
  query: string
  setQuery: (v: string) => void
  selected: DbQueryHistoryItem | null
  onSelect: (id: string) => void
  activeConn?: DbConnectionPublic
  onCopy: (text: string) => void
  onOpenEditor: (item: DbQueryHistoryItem) => void
  onRerun: (item: DbQueryHistoryItem) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex w-[420px] flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface">
        <div className="flex flex-col gap-3 border-b border-border-subtle p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-text-primary">
              Query History
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history…"
              className="w-full rounded-full border border-border-strong bg-bg-elevated py-1.5 pl-9 pr-3 text-[12px] outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            {(
              [
                ['all', 'All'],
                ['ok', 'Success'],
                ['fail', 'Failed']
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={clsx(
                  'rounded-full border px-3 py-1 text-[12px] transition-colors',
                  filter === id
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border-strong bg-bg-elevated text-text-secondary hover:bg-bg-hover'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-2 py-8 text-center text-[12px] text-text-muted">
              No query history yet
            </p>
          ) : (
            items.map((h) => {
              const active = selected?.id === h.id
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onSelect(h.id)}
                  className={clsx(
                    'relative flex flex-col rounded-lg border p-3 text-left transition-colors',
                    active
                      ? 'border-border-strong bg-bg-elevated'
                      : 'border-transparent hover:border-border-subtle hover:bg-bg-card'
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
                  )}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {h.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-danger" />
                      )}
                      <span className="text-[10px] text-text-muted">
                        {relativeTime(h.createdAt)}
                      </span>
                    </div>
                    <span className="rounded bg-bg-card px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
                      {h.durationMs != null ? `${h.durationMs}ms` : '—'}
                    </span>
                  </div>
                  <p className="line-clamp-2 font-mono text-[12px] leading-relaxed text-text-secondary">
                    {h.sql}
                  </p>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        {selected ? (
          <>
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-border-subtle bg-bg-surface p-4">
              <div>
                <h3 className="mb-1 text-[15px] font-semibold text-text-primary">
                  Query Detail
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-[12px] text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Database className="h-3.5 w-3.5" />
                    {activeConn?.name || selected.connectionId}
                  </span>
                  {activeConn && (
                    <span>{ENGINE_FULL[activeConn.engine]}</span>
                  )}
                  <span>{new Date(selected.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <ToolButton onClick={() => onCopy(selected.sql)}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </ToolButton>
                <ToolButton onClick={() => onOpenEditor(selected)}>
                  Editor
                </ToolButton>
                <ToolButton
                  variant="primary"
                  onClick={() => onRerun(selected)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Re-run
                </ToolButton>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <StatCard
                  label="Status"
                  value={
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1.5',
                        selected.ok ? 'text-success' : 'text-danger'
                      )}
                    >
                      {selected.ok ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      {selected.ok ? 'Success' : 'Failed'}
                    </span>
                  }
                />
                <StatCard
                  label="Duration"
                  value={`${selected.durationMs ?? '—'} ms`}
                />
                <StatCard
                  label="Connection"
                  value={activeConn?.name || selected.connectionId}
                />
                <StatCard
                  label="When"
                  value={relativeTime(selected.createdAt)}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
                <div className="flex h-8 items-center justify-between border-b border-border-subtle px-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    {activeConn
                      ? `${ENGINE_FULL[activeConn.engine]} Dialect`
                      : 'SQL'}
                  </span>
                </div>
                <pre className="flex-1 overflow-auto p-4 font-mono text-[12px] leading-relaxed text-text-primary whitespace-pre-wrap">
                  {selected.sql}
                </pre>
                {selected.error && (
                  <div className="border-t border-danger/30 bg-danger/10 p-3 font-mono text-[12px] text-danger">
                    {selected.error}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-text-muted">
            Select a query from history
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border-subtle/60 bg-bg-card p-3">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div className="font-mono text-[13px] text-text-primary">{value}</div>
    </div>
  )
}
