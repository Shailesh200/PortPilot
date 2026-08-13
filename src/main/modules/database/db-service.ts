import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync
} from 'fs'
import { randomUUID } from 'crypto'
import {
  decryptSecret,
  storedSecretUnreadable,
  saveSecret,
  loadSecret,
  deleteSecrets,
  secretIndexHas,
  rememberSecret,
  forgetPersistedSecret,
  getUserDataPath,
  userDataFile
} from '../../os'
import postgres from 'postgres'
import mysql from 'mysql2/promise'
import { createClient, type RedisClientType } from 'redis'
import { MongoClient, type Db } from 'mongodb'
import { createClient as createLibsql, type Client as LibsqlClient } from '@libsql/client'
import { openSshTunnel } from './ssh-tunnel'
import {
  isDestructiveSql,
  isMutatingSql,
  splitSqlStatements,
  wrapExplain
} from './sql-safety'
import type {
  DbAccessInfo,
  DbAccessMode,
  DbColumnInfo,
  DbConnectionPublic,
  DbEngine,
  DbIndexInfo,
  DbQueryHistoryItem,
  DbSavedQuery,
  DbTableSchema,
  DbTreeObject
} from '../../../shared/types'

export interface DbConnectionProfile extends DbConnectionPublic {
  passwordEnc?: string
  sshPasswordEnc?: string
}

const RESAVE_SECRET_ERROR =
  'Saved password can’t be read. Open the connection, enter the password, and save it again.'

interface StoreFile {
  connections: DbConnectionProfile[]
  history: DbQueryHistoryItem[]
  savedQueries: DbSavedQuery[]
}

let store: StoreFile = { connections: [], history: [], savedQueries: [] }
let storeLoaded = false
const live = new Map<string, unknown>()
const tunnels = new Map<string, { close: () => void; localPort: number }>()

function storePath(): string {
  return userDataFile('db-connections.json')
}

function persist(): void {
  try {
    const dir = getUserDataPath()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const target = storePath()
    const tmp = `${target}.tmp`
    writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8')
    renameSync(tmp, target)
  } catch {
    /* ignore */
  }
}

export function loadDbStore(): StoreFile {
  if (storeLoaded) return store
  storeLoaded = true
  try {
    if (existsSync(storePath())) {
      store = JSON.parse(readFileSync(storePath(), 'utf-8')) as StoreFile
      if (!Array.isArray(store.connections)) store.connections = []
      if (!Array.isArray(store.history)) store.history = []
      if (!Array.isArray(store.savedQueries)) store.savedQueries = []
    }
  } catch {
    store = { connections: [], history: [], savedQueries: [] }
  }
  return store
}

export function listConnections(): DbConnectionPublic[] {
  return store.connections.map(
    ({ passwordEnc, sshPasswordEnc, ...rest }) => ({
      ...rest,
      hasPassword: Boolean(passwordEnc) || secretIndexHas(rest.id, 'password'),
      hasSshPassword:
        Boolean(sshPasswordEnc) || secretIndexHas(rest.id, 'ssh')
    })
  )
}

/** IDs with an open live session in this app process (survives UI remounts). */
export function listLiveConnectionIds(): string[] {
  return [...live.keys()]
}

export function saveConnection(
  profile: DbConnectionProfile & {
    password?: string
    sshPassword?: string
    savePassword?: boolean
    hasPassword?: boolean
    hasSshPassword?: boolean
  }
): void {
  const {
    password,
    sshPassword,
    savePassword = true,
    hasPassword: _hasPassword,
    hasSshPassword: _hasSshPassword,
    ...rest
  } = profile
  const existing = store.connections.find((c) => c.id === profile.id)

  const applySecret = (kind: 'password' | 'ssh', value?: string) => {
    if (value) {
      if (savePassword) saveSecret(profile.id, kind, value)
      else {
        rememberSecret(profile.id, kind, value)
        forgetPersistedSecret(profile.id, kind)
      }
      return
    }
    if (!savePassword) forgetPersistedSecret(profile.id, kind)
  }
  applySecret('password', password)
  applySecret('ssh', sshPassword)

  const next: DbConnectionProfile = { ...rest }
  if (
    savePassword &&
    !password &&
    existing?.passwordEnc &&
    !secretIndexHas(profile.id, 'password')
  ) {
    next.passwordEnc = existing.passwordEnc
  }
  if (
    savePassword &&
    !sshPassword &&
    existing?.sshPasswordEnc &&
    !secretIndexHas(profile.id, 'ssh')
  ) {
    next.sshPasswordEnc = existing.sshPasswordEnc
  }
  const idx = store.connections.findIndex((c) => c.id === next.id)
  if (idx >= 0) store.connections[idx] = next
  else store.connections.push(next)
  persist()
}

export function deleteConnection(id: string): void {
  store.connections = store.connections.filter((c) => c.id !== id)
  store.history = store.history.filter((h) => h.connectionId !== id)
  store.savedQueries = store.savedQueries.filter((q) => q.connectionId !== id)
  deleteSecrets(id)
  void disconnect(id)
  persist()
}

function resolveSecret(
  profile: DbConnectionProfile,
  kind: 'password' | 'ssh'
): { value: string; needsResave: boolean } {
  const fromVault = loadSecret(profile.id, kind)
  if (fromVault) return { value: fromVault, needsResave: false }
  const legacyEnc =
    kind === 'password' ? profile.passwordEnc : profile.sshPasswordEnc
  if (!legacyEnc) return { value: '', needsResave: false }
  if (storedSecretUnreadable(legacyEnc)) {
    return { value: '', needsResave: true }
  }
  const plain = decryptSecret(legacyEnc)
  if (plain) {
    saveSecret(profile.id, kind, plain)
    if (kind === 'password') delete profile.passwordEnc
    else delete profile.sshPasswordEnc
    persist()
  }
  return { value: plain, needsResave: false }
}

function closeTunnel(id: string): void {
  const t = tunnels.get(id)
  if (!t) return
  tunnels.delete(id)
  try {
    t.close()
  } catch {
    /* */
  }
}

async function ensureSshTunnel(
  id: string,
  profile: DbConnectionProfile,
  targetHost: string,
  targetPort: number
): Promise<{ host: string; port: number } | { error: string }> {
  if (!profile.sshEnabled) {
    return { host: targetHost, port: targetPort }
  }
  if (!profile.sshHost?.trim() || !profile.sshUser?.trim()) {
    return {
      error: 'SSH tunnel enabled but SSH Host / User are missing'
    }
  }
  closeTunnel(id)
  const sshSecret = resolveSecret(profile, 'ssh')
  if (sshSecret.needsResave) {
    return { error: RESAVE_SECRET_ERROR }
  }
  try {
    const handle = await openSshTunnel({
      sshHost: profile.sshHost.trim(),
      sshPort: profile.sshPort || 22,
      sshUser: profile.sshUser.trim(),
      sshPassword: sshSecret.value || undefined,
      privateKeyPath: profile.sshPrivateKeyPath || undefined,
      targetHost,
      targetPort,
      localPort: profile.sshLocalPort || 0
    })
    tunnels.set(id, handle)
    return { host: '127.0.0.1', port: handle.localPort }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

function buildMongoUri(
  profile: DbConnectionProfile,
  password: string
): string {
  const host = (profile.host || 'localhost').trim()
  if (/^mongodb(\+srv)?:\/\//i.test(host)) {
    return host
  }
  const port = profile.port || 27017
  const db = profile.database || 'test'
  const user = profile.user?.trim()
  const auth =
    user && password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
      : user
        ? `${encodeURIComponent(user)}@`
        : ''
  const params = profile.ssl ? '?tls=true' : ''
  return `mongodb://${auth}${host}:${port}/${db}${params}`
}

type MongoLive = { kind: 'mongodb'; client: MongoClient; db: Db }
type LibsqlLive = { kind: 'libsql'; client: LibsqlClient }

function isMongoLive(c: unknown): c is MongoLive {
  return (
    !!c &&
    typeof c === 'object' &&
    'kind' in c &&
    (c as { kind: string }).kind === 'mongodb'
  )
}

function isLibsqlLive(c: unknown): c is LibsqlLive {
  return (
    !!c &&
    typeof c === 'object' &&
    'kind' in c &&
    (c as { kind: string }).kind === 'libsql'
  )
}

function normalizeLibsqlUrl(raw: string): string {
  const url = raw.trim()
  if (!url) throw new Error('Turso / libSQL URL is required')
  if (
    /^libsql:\/\//i.test(url) ||
    /^https?:\/\//i.test(url) ||
    /^file:/i.test(url)
  ) {
    return url
  }
  // bare hostname from Turso dashboard
  return `libsql://${url.replace(/^\/\//, '')}`
}

function isSqliteLive(
  c: unknown
): c is {
  kind: 'sqlite'
  db: { export: () => Uint8Array; close: () => void }
  file?: string
} {
  return (
    !!c &&
    typeof c === 'object' &&
    'kind' in c &&
    (c as { kind: string }).kind === 'sqlite'
  )
}

/** Convert tabular SQL-ish or mongo helpers into a find result. */
async function runMongoQuery(
  db: Db,
  text: string
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Empty query')

  if (/^show\s+collections$/i.test(trimmed)) {
    const cols = await db.listCollections().toArray()
    return {
      columns: ['name', 'type'],
      rows: cols.map((c) => [c.name, c.type || 'collection'])
    }
  }

  // JSON command: { "find": "users", "filter": {...}, "limit": 100 }
  if (trimmed.startsWith('{')) {
    const cmd = JSON.parse(trimmed) as {
      find?: string
      filter?: Record<string, unknown>
      limit?: number
      projection?: Record<string, unknown>
      sort?: Record<string, unknown>
    }
    if (!cmd.find) throw new Error('JSON command needs a "find" collection name')
    let cursor = db.collection(cmd.find).find(cmd.filter || {})
    if (cmd.projection) cursor = cursor.project(cmd.projection)
    if (cmd.sort) cursor = cursor.sort(cmd.sort as Record<string, 1 | -1>)
    cursor = cursor.limit(Math.min(cmd.limit ?? 100, 1000))
    const docs = await cursor.toArray()
    return docsToGrid(docs)
  }

  // db.users.find({...}).limit(n)
  const findMatch = trimmed.match(
    /^db\.([A-Za-z0-9_]+)\.find\(\s*(\{[\s\S]*\})?\s*\)(?:\.limit\(\s*(\d+)\s*\))?/i
  )
  if (findMatch) {
    const coll = findMatch[1]
    const filter = findMatch[2] ? (JSON.parse(findMatch[2]) as object) : {}
    const limit = findMatch[3] ? Number(findMatch[3]) : 100
    const docs = await db
      .collection(coll)
      .find(filter)
      .limit(Math.min(limit, 1000))
      .toArray()
    return docsToGrid(docs)
  }

  // SELECT * FROM users [WHERE {...json...}] [LIMIT n]
  const selectMatch = trimmed.match(
    /^select\s+\*\s+from\s+([A-Za-z0-9_]+)(?:\s+where\s+([\s\S]+?))?(?:\s+limit\s+(\d+))?\s*;?$/i
  )
  if (selectMatch) {
    const coll = selectMatch[1]
    let filter: object = {}
    if (selectMatch[2]) {
      const where = selectMatch[2].trim()
      if (where.startsWith('{')) filter = JSON.parse(where) as object
      else
        throw new Error(
          'MongoDB WHERE must be JSON, e.g. WHERE {"status":"active"}'
        )
    }
    const limit = selectMatch[3] ? Number(selectMatch[3]) : 100
    const docs = await db
      .collection(coll)
      .find(filter)
      .limit(Math.min(limit, 1000))
      .toArray()
    return docsToGrid(docs)
  }

  throw new Error(
    'MongoDB supports: show collections | db.coll.find({}).limit(100) | SELECT * FROM coll WHERE {...} LIMIT 100 | {"find":"coll","filter":{},"limit":100}'
  )
}

function docsToGrid(docs: Record<string, unknown>[]): {
  columns: string[]
  rows: unknown[][]
} {
  if (docs.length === 0) return { columns: ['_id'], rows: [] }
  const keySet = new Set<string>()
  for (const d of docs) {
    for (const k of Object.keys(d)) keySet.add(k)
  }
  const columns = Array.from(keySet)
  if (columns.includes('_id')) {
    columns.splice(columns.indexOf('_id'), 1)
    columns.unshift('_id')
  }
  const rows = docs.map((d) =>
    columns.map((c) => {
      const v = d[c]
      if (v == null) return null
      if (typeof v === 'object') {
        try {
          return JSON.stringify(v)
        } catch {
          return String(v)
        }
      }
      return v
    })
  )
  return { columns, rows }
}

function parseSqlUrl(
  raw: string
): {
  host: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
} | null {
  const trimmed = raw.trim()
  if (!/^(postgres(ql)?|mysql):\/\//i.test(trimmed)) return null
  try {
    const u = new URL(trimmed)
    const database = u.pathname.replace(/^\//, '') || undefined
    const sslMode = u.searchParams.get('sslmode')
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : undefined,
      database,
      user: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      ssl:
        sslMode === 'require' ||
        sslMode === 'verify-full' ||
        sslMode === 'verify-ca' ||
        u.searchParams.get('ssl') === 'true'
    }
  } catch {
    return null
  }
}

/** Hostnames that only resolve inside Docker Compose — not from the laptop. */
const DOCKER_ONLY_HOSTS = new Set([
  'postgres',
  'postgresql',
  'db',
  'database',
  'mysql',
  'redis',
  'mongo',
  'mongodb'
])

export async function connect(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = store.connections.find((c) => c.id === id)
  if (!profile) return { ok: false, error: 'Connection not found' }
  try {
    await disconnect(id)
    const passwordSecret = resolveSecret(profile, 'password')
    if (passwordSecret.needsResave) {
      return { ok: false, error: RESAVE_SECRET_ERROR }
    }
    const storedPassword = passwordSecret.value
    switch (profile.engine) {
      case 'postgres': {
        const fromUrl = profile.host ? parseSqlUrl(profile.host) : null
        let host = fromUrl?.host || profile.host || 'localhost'
        // postgres.js uses a Unix socket for "localhost" → ENOENT if no local server socket
        if (host === 'localhost' || host === '::1') host = '127.0.0.1'
        let port = fromUrl?.port || profile.port || 5432
        const database =
          fromUrl?.database || profile.database || 'postgres'
        const username = fromUrl?.user || profile.user || 'postgres'
        const password = fromUrl?.password || storedPassword
        const ssl = fromUrl?.ssl ?? profile.ssl

        if (/^(postgres(ql)?:\/\/)/i.test((profile.host || '').trim()) && !fromUrl) {
          return {
            ok: false,
            error:
              'Could not parse the postgresql:// URL in Host. Split it into Host, Port, Database, User, Password fields instead.'
          }
        }

        if (!profile.sshEnabled && DOCKER_ONLY_HOSTS.has(host.toLowerCase())) {
          return {
            ok: false,
            error:
              `Host "${host}" only works inside Docker (Coolify). ` +
              `Enable Use SSH Tunnel (remote host stays "${host}") or run: ` +
              `ssh -L 5433:postgres:5432 user@server — then Host=127.0.0.1 Port=5433.`
          }
        }

        const via = await ensureSshTunnel(id, profile, host, port)
        if ('error' in via) return { ok: false, error: via.error }
        host = via.host
        port = via.port

        const sql = postgres({
          host,
          port,
          database,
          username,
          password,
          ssl: ssl ? 'require' : false,
          max: 1,
          connect_timeout: 15
        })
        await sql`select 1`
        live.set(id, sql)
        break
      }
      case 'mysql': {
        const fromUrl = profile.host ? parseSqlUrl(profile.host) : null
        let host = fromUrl?.host || profile.host || 'localhost'
        let port = fromUrl?.port || profile.port || 3306
        if (!profile.sshEnabled && DOCKER_ONLY_HOSTS.has(host.toLowerCase())) {
          return {
            ok: false,
            error:
              `Host "${host}" only works inside Docker. Enable SSH tunnel or use a public hostname.`
          }
        }
        const via = await ensureSshTunnel(id, profile, host, port)
        if ('error' in via) return { ok: false, error: via.error }
        host = via.host
        port = via.port
        const conn = await mysql.createConnection({
          host,
          port,
          database: fromUrl?.database || profile.database,
          user: fromUrl?.user || profile.user,
          password: fromUrl?.password || storedPassword,
          ssl: (fromUrl?.ssl ?? profile.ssl) ? {} : undefined
        })
        await conn.query('select 1')
        live.set(id, conn)
        break
      }
      case 'sqlite': {
        // sql.js (wasm-free asm build) for portable Electron packaging
        const initSqlJs = (await import('sql.js')).default
        const SQL = await initSqlJs()
        const file = profile.filePath
        const db =
          file && existsSync(file)
            ? new SQL.Database(readFileSync(file))
            : new SQL.Database()
        live.set(id, { kind: 'sqlite', db, file })
        break
      }
      case 'redis': {
        let host = profile.host || '127.0.0.1'
        let port = profile.port || 6379
        const via = await ensureSshTunnel(id, profile, host, port)
        if ('error' in via) return { ok: false, error: via.error }
        host = via.host
        port = via.port
        const client = createClient({
          socket: {
            host,
            port,
            tls: profile.ssl || undefined
          },
          password: storedPassword || undefined
        })
        await client.connect()
        await client.ping()
        live.set(id, client)
        break
      }
      case 'mongodb': {
        let uri = buildMongoUri(profile, storedPassword)
        if (profile.sshEnabled) {
          const fromUriHost = (() => {
            try {
              if (/^mongodb(\+srv)?:\/\//i.test((profile.host || '').trim())) {
                return new URL(profile.host!.trim()).hostname
              }
            } catch {
              /* */
            }
            return profile.host || '127.0.0.1'
          })()
          const targetPort = profile.port || 27017
          const via = await ensureSshTunnel(id, profile, fromUriHost, targetPort)
          if ('error' in via) return { ok: false, error: via.error }
          // Rebuild simple mongodb:// to localhost tunnel
          const user = profile.user
            ? `${encodeURIComponent(profile.user)}:${encodeURIComponent(storedPassword)}@`
            : ''
          const db = profile.database || 'test'
          uri = `mongodb://${user}127.0.0.1:${via.port}/${db}`
        }
        const client = new MongoClient(uri)
        await client.connect()
        const dbName = profile.database || 'test'
        const db = client.db(dbName)
        await db.command({ ping: 1 })
        live.set(id, { kind: 'mongodb', client, db } satisfies MongoLive)
        break
      }
      case 'libsql': {
        const url = normalizeLibsqlUrl(profile.host || profile.filePath || '')
        if (!storedPassword) {
          return {
            ok: false,
            error:
              'Missing auth token. Paste the Turso DATABASE_AUTH_TOKEN, Save, then Connect again.'
          }
        }
        const client = createLibsql({
          url,
          authToken: storedPassword
        })
        await client.execute('select 1')
        live.set(id, { kind: 'libsql', client } satisfies LibsqlLive)
        break
      }
    }
    return { ok: true }
  } catch (e) {
    closeTunnel(id)
    live.delete(id)
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function disconnect(id: string): Promise<void> {
  const c = live.get(id)
  live.delete(id)
  closeTunnel(id)
  if (!c) return
  try {
    if (isSqliteLive(c)) {
      if (c.file) {
        writeFileSync(c.file, Buffer.from(c.db.export()))
      }
      c.db.close()
    } else if (isMongoLive(c)) {
      await c.client.close()
    } else if (isLibsqlLive(c)) {
      c.client.close()
    } else if (typeof (c as { end?: () => Promise<void> }).end === 'function') {
      await (c as { end: () => Promise<void> }).end()
    } else if (
      typeof (c as { quit?: () => Promise<void> }).quit === 'function'
    ) {
      await (c as { quit: () => Promise<void> }).quit()
    }
  } catch {
    /* ignore */
  }
}

export async function disconnectAll(): Promise<void> {
  await Promise.all([...live.keys()].map((id) => disconnect(id)))
}

export async function runQuery(
  connectionId: string,
  sqlText: string,
  opts?: { silent?: boolean; allowDestructive?: boolean }
): Promise<{
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs: number
  error?: string
  needsConfirm?: boolean
}> {
  const started = Date.now()
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) {
    return { ok: false, durationMs: 0, error: 'Connection not found' }
  }
  if (profile.readOnly && isMutatingSql(sqlText)) {
    return {
      ok: false,
      durationMs: 0,
      error:
        'Connection is in read-only mode. Disable “Read-only” on the connection to run mutating SQL.'
    }
  }
  if (isDestructiveSql(sqlText) && !opts?.allowDestructive && !opts?.silent) {
    return {
      ok: false,
      durationMs: 0,
      needsConfirm: true,
      error:
        'This looks destructive (DELETE without WHERE / DROP / TRUNCATE). Confirm to proceed.'
    }
  }
  if (!live.has(connectionId)) {
    const r = await connect(connectionId)
    if (!r.ok) return { ok: false, durationMs: 0, error: r.error }
  }
  try {
    let columns: string[] = []
    let rows: unknown[][] = []
    const statements = splitSqlStatements(sqlText)
    const toRun =
      statements.length > 1 &&
      profile.engine !== 'redis' &&
      profile.engine !== 'mongodb'
        ? statements
        : [sqlText.trim()]
    const client = live.get(connectionId)
    for (let si = 0; si < toRun.length; si++) {
      const sqlOne = toRun[si]
      switch (profile.engine) {
        case 'postgres': {
          const sqlTag = client as ReturnType<typeof postgres>
          const result = await sqlTag.unsafe(sqlOne)
          columns = result.columns?.map((c) => c.name) || []
          rows = result.map((row) =>
            columns.map((c) => (row as Record<string, unknown>)[c])
          )
          break
        }
        case 'mysql': {
          const conn = client as mysql.Connection
          const [res, fields] = await conn.query(sqlOne)
          if (Array.isArray(fields)) {
            columns = fields.map((f) => f.name)
          }
          if (Array.isArray(res)) {
            rows = (res as Record<string, unknown>[]).map((row) =>
              columns.map((c) => row[c])
            )
          }
          break
        }
        case 'sqlite': {
          const wrap = client as {
            db: {
              exec: (s: string) => { columns: string[]; values: unknown[][] }[]
            }
          }
          const exec = wrap.db.exec(sqlOne)
          if (exec[0]) {
            columns = exec[0].columns
            rows = exec[0].values
          } else {
            columns = []
            rows = []
          }
          break
        }
        case 'redis': {
          const redis = client as RedisClientType
          const parts = sqlOne.trim().split(/\s+/)
          const cmd = parts[0]?.toUpperCase() || 'PING'
          const args = parts.slice(1)
          let value: unknown
          if (cmd === 'GET') value = await redis.get(args[0])
          else if (cmd === 'KEYS') value = await redis.keys(args[0] || '*')
          else if (cmd === 'PING') value = await redis.ping()
          else if (cmd === 'INFO') value = await redis.info()
          else
            value = await (
              redis as unknown as {
                sendCommand: (a: string[]) => Promise<unknown>
              }
            ).sendCommand([cmd, ...args])
          columns = ['result']
          rows = [[typeof value === 'string' ? value : JSON.stringify(value)]]
          break
        }
        case 'mongodb': {
          if (!isMongoLive(client)) throw new Error('MongoDB client not ready')
          const grid = await runMongoQuery(client.db, sqlOne)
          columns = grid.columns
          rows = grid.rows
          break
        }
        case 'libsql': {
          if (!isLibsqlLive(client)) throw new Error('libSQL client not ready')
          const result = await client.client.execute(sqlOne)
          columns = result.columns
          rows = result.rows.map((row) =>
            columns.map((c) => {
              const v = row[c]
              if (v == null) return null
              if (typeof v === 'object') {
                try {
                  return JSON.stringify(v)
                } catch {
                  return String(v)
                }
              }
              return v
            })
          )
          break
        }
      }
    }
    const durationMs = Date.now() - started
    if (!opts?.silent) {
      pushHistory({
        id: `${Date.now()}`,
        connectionId,
        sql: sqlText,
        createdAt: Date.now(),
        durationMs,
        ok: true
      })
    }
    return { ok: true, columns, rows, durationMs }
  } catch (e) {
    const durationMs = Date.now() - started
    const error = e instanceof Error ? e.message : String(e)
    if (!opts?.silent) {
      pushHistory({
        id: `${Date.now()}`,
        connectionId,
        sql: sqlText,
        createdAt: Date.now(),
        durationMs,
        ok: false,
        error
      })
    }
    return { ok: false, durationMs, error }
  }
}

function pushHistory(item: DbQueryHistoryItem): void {
  store.history = [item, ...store.history].slice(0, 200)
  persist()
}

export function getQueryHistory(connectionId?: string): DbQueryHistoryItem[] {
  if (!connectionId) return store.history
  return store.history.filter((h) => h.connectionId === connectionId)
}

async function probeWriteCapability(
  connectionId: string,
  engine: DbEngine
): Promise<boolean | null> {
  try {
    if (engine === 'sqlite' || engine === 'libsql') {
      const r = await runQuery(
        connectionId,
        'CREATE TEMP TABLE IF NOT EXISTS __pp_write_probe(x INT); DROP TABLE IF EXISTS __pp_write_probe;',
        { silent: true }
      )
      return r.ok
    }
    if (engine === 'postgres') {
      const r = await runQuery(
        connectionId,
        'CREATE TEMP TABLE __pp_write_probe(x INT); DROP TABLE __pp_write_probe;',
        { silent: true }
      )
      return r.ok
    }
    if (engine === 'mysql') {
      const r = await runQuery(
        connectionId,
        'CREATE TEMPORARY TABLE __pp_write_probe(x INT); DROP TEMPORARY TABLE __pp_write_probe;',
        { silent: true }
      )
      return r.ok
    }
    return null
  } catch {
    return false
  }
}

/**
 * Inspect the live connection for read vs write capability.
 * Best-effort — some engines/tokens expose limited privilege metadata.
 */
export async function getAccessInfo(
  connectionId: string
): Promise<{ ok: boolean; info?: DbAccessInfo; error?: string }> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, error: 'Connection not found' }
  if (!live.has(connectionId)) {
    const r = await connect(connectionId)
    if (!r.ok) return { ok: false, error: r.error }
  }

  const details: string[] = []
  let mode: DbAccessMode = 'unknown'
  let user: string | undefined
  let database: string | undefined = profile.database

  try {
    switch (profile.engine) {
      case 'postgres': {
        const meta = await runQuery(
          connectionId,
          `SELECT
            current_user AS usr,
            current_database() AS db,
            current_setting('transaction_read_only') AS txn_ro,
            pg_is_in_recovery()::text AS in_recovery,
            COALESCE(
              (SELECT rolsuper::text FROM pg_roles WHERE rolname = current_user),
              'false'
            ) AS is_super,
            has_database_privilege(current_database(), 'CREATE')::text AS can_create`,
          { silent: true }
        )
        if (meta.ok && meta.rows?.[0]) {
          const [usr, db, txnRo, inRecovery, isSuper, canCreate] = meta.rows[0]
          user = String(usr)
          database = String(db)
          details.push(`User ${user}`)
          if (String(isSuper) === 'true') details.push('Superuser')
          if (String(inRecovery) === 'true') {
            details.push('Replica (in recovery)')
            mode = 'read-only'
          } else if (String(txnRo) === 'on') {
            details.push('transaction_read_only=on')
            mode = 'read-only'
          } else if (String(canCreate) === 'true') {
            details.push('Can CREATE in database')
            mode = 'read-write'
          } else {
            const writable = await probeWriteCapability(connectionId, 'postgres')
            if (writable === true) {
              details.push('Write probe OK (temp table)')
              mode = 'read-write'
            } else if (writable === false) {
              details.push('Write probe failed')
              mode = 'read-only'
            } else {
              details.push('CREATE privilege: no')
              mode = 'unknown'
            }
          }
        }
        break
      }
      case 'mysql': {
        const meta = await runQuery(
          connectionId,
          `SELECT CURRENT_USER(), DATABASE(), @@read_only, @@super_read_only`,
          { silent: true }
        )
        if (meta.ok && meta.rows?.[0]) {
          user = String(meta.rows[0][0])
          database = meta.rows[0][1] != null ? String(meta.rows[0][1]) : database
          const readOnly = Number(meta.rows[0][2]) === 1
          const superRo = Number(meta.rows[0][3]) === 1
          details.push(`User ${user}`)
          if (superRo || readOnly) {
            details.push(superRo ? 'super_read_only' : 'read_only')
            mode = 'read-only'
          } else {
            const writable = await probeWriteCapability(connectionId, 'mysql')
            mode = writable === false ? 'read-only' : 'read-write'
            details.push(
              writable === false ? 'Write probe failed' : 'Server not read-only'
            )
          }
        }
        break
      }
      case 'sqlite': {
        const file = profile.filePath
        database = file || ':memory:'
        details.push(file ? `File ${file}` : 'In-memory DB')
        if (file && existsSync(file)) {
          try {
            const { accessSync, constants } = await import('fs')
            accessSync(file, constants.W_OK)
            mode = 'read-write'
            details.push('File is writable')
          } catch {
            mode = 'read-only'
            details.push('File is not writable')
          }
        } else {
          const writable = await probeWriteCapability(connectionId, 'sqlite')
          mode = writable === false ? 'read-only' : 'read-write'
        }
        break
      }
      case 'libsql': {
        database = profile.host || database
        details.push('Turso / libSQL token session')
        const writable = await probeWriteCapability(connectionId, 'libsql')
        if (writable === true) {
          mode = 'read-write'
          details.push('Write probe OK')
        } else if (writable === false) {
          mode = 'read-only'
          details.push('Token appears read-only')
        }
        break
      }
      case 'redis': {
        const client = live.get(connectionId) as RedisClientType
        try {
          const info = await client.info('replication')
          const role = /role:(\w+)/i.exec(info)?.[1] || 'unknown'
          details.push(`Role: ${role}`)
          if (role === 'slave' || role === 'replica') {
            mode = 'read-only'
          } else {
            mode = 'read-write'
          }
        } catch {
          mode = 'unknown'
          details.push('Could not read replication INFO')
        }
        try {
          const who = await (
            client as unknown as {
              sendCommand: (a: string[]) => Promise<unknown>
            }
          ).sendCommand(['ACL', 'WHOAMI'])
          if (who != null) {
            user = String(who)
            details.push(`ACL user ${user}`)
          }
        } catch {
          /* ACL may be unavailable */
        }
        break
      }
      case 'mongodb': {
        if (!isMongoLive(live.get(connectionId))) break
        const mongo = live.get(connectionId) as MongoLive
        database = mongo.db.databaseName
        try {
          const status = (await mongo.db.command({
            connectionStatus: 1
          })) as {
            authInfo?: {
              authenticatedUsers?: { user: string; db: string }[]
              authenticatedUserPrivileges?: unknown[]
            }
          }
          const users = status.authInfo?.authenticatedUsers || []
          if (users[0]) {
            user = `${users[0].user}@${users[0].db}`
            details.push(`Auth ${user}`)
          }
          const privCount =
            status.authInfo?.authenticatedUserPrivileges?.length ?? 0
          if (privCount > 0) details.push(`${privCount} privilege entries`)
        } catch {
          details.push('No auth privilege metadata')
        }
        // Probe: insert+delete on a throwaway collection is too invasive.
        // Use listCollections + assumed RW unless error on create.
        try {
          const coll = mongo.db.collection('__pp_write_probe')
          await coll.insertOne({ t: Date.now() })
          await coll.drop()
          mode = 'read-write'
          details.push('Write probe OK')
        } catch {
          mode = 'read-only'
          details.push('Write probe failed (likely read-only user)')
        }
        break
      }
    }

    return {
      ok: true,
      info: {
        mode: profile.readOnly ? 'read-only' : mode,
        user,
        database,
        details: profile.readOnly
          ? ['Client read-only mode enabled', ...details]
          : details
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

function quoteIdent(engine: DbEngine, name: string): string {
  // Support schema-qualified names: public.users
  if (name.includes('.')) {
    return name
      .split('.')
      .map((part) => quoteIdent(engine, part))
      .join('.')
  }
  const safe = name.replace(/"/g, '""')
  if (engine === 'mysql') return `\`${name.replace(/`/g, '``')}\``
  return `"${safe}"`
}

export async function listTables(
  connectionId: string
): Promise<{
  ok: boolean
  tables?: string[]
  objects?: DbTreeObject[]
  error?: string
}> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, error: 'Not found' }
  if (profile.engine === 'redis') {
    return { ok: true, tables: [], objects: [] }
  }
  if (profile.engine === 'mongodb') {
    if (!live.has(connectionId)) {
      const r = await connect(connectionId)
      if (!r.ok) return { ok: false, error: r.error }
    }
    const client = live.get(connectionId)
    if (!isMongoLive(client)) return { ok: false, error: 'MongoDB not ready' }
    try {
      const cols = await client.db.listCollections().toArray()
      const names = cols.map((c) => c.name).sort()
      return {
        ok: true,
        tables: names,
        objects: names.map((name) => ({
          name,
          qualified: name,
          kind: 'collection' as const
        }))
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }

  if (profile.engine === 'postgres') {
    const r = await runQuery(
      connectionId,
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name`,
      { silent: true }
    )
    if (!r.ok) return { ok: false, error: r.error }
    const objects: DbTreeObject[] = (r.rows || []).map((row) => {
      const schema = String(row[0])
      const name = String(row[1])
      const typ = String(row[2] || '').toUpperCase()
      return {
        schema,
        name,
        qualified: `${schema}.${name}`,
        kind: typ.includes('VIEW') ? ('view' as const) : ('table' as const)
      }
    })
    return {
      ok: true,
      tables: objects.map((o) => o.qualified),
      objects
    }
  }

  let sql = ''
  if (profile.engine === 'mysql') {
    sql = 'show tables'
  } else if (profile.engine === 'sqlite' || profile.engine === 'libsql') {
    sql = "select name from sqlite_master where type='table' order by 1"
  } else {
    sql = "select name from sqlite_master where type='table' order by 1"
  }
  const r = await runQuery(connectionId, sql)
  if (!r.ok) return { ok: false, error: r.error }
  const names = (r.rows || []).map((row) => String(row[0]))
  return {
    ok: true,
    tables: names,
    objects: names.map((name) => ({
      name,
      qualified: name,
      kind: 'table' as const
    }))
  }
}

export function analyzeSql(sql: string): {
  mutating: boolean
  destructive: boolean
  statements: number
} {
  return {
    mutating: isMutatingSql(sql),
    destructive: isDestructiveSql(sql),
    statements: splitSqlStatements(sql).length
  }
}

export async function explainQuery(
  connectionId: string,
  sqlText: string,
  analyze: boolean
): Promise<{
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs: number
  error?: string
}> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, durationMs: 0, error: 'Connection not found' }
  if (
    profile.engine === 'redis' ||
    profile.engine === 'mongodb'
  ) {
    return {
      ok: false,
      durationMs: 0,
      error: 'EXPLAIN is not supported for this engine'
    }
  }
  const first = splitSqlStatements(sqlText)[0]
  if (!first) return { ok: false, durationMs: 0, error: 'Empty SQL' }
  const wrapped = wrapExplain(profile.engine, first, analyze)
  return runQuery(connectionId, wrapped)
}

export async function browseTable(
  connectionId: string,
  table: string,
  opts: { where?: string; limit?: number; offset?: number }
): Promise<{
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  total?: number
  durationMs: number
  error?: string
}> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, durationMs: 0, error: 'Connection not found' }
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 5000))
  const offset = Math.max(0, opts.offset ?? 0)
  const whereRaw = (opts.where || '').trim()

  if (profile.engine === 'mongodb') {
    const filter = whereRaw || '{}'
    const q = `db.${table}.find(${filter}).skip(${offset}).limit(${limit})`
    const r = await runQuery(connectionId, q, { silent: true })
    return { ...r, total: undefined }
  }
  if (profile.engine === 'redis') {
    return {
      ok: false,
      durationMs: 0,
      error: 'Use the SQL editor for Redis commands'
    }
  }

  const ident = quoteIdent(profile.engine, table)
  const whereSql = whereRaw ? ` WHERE ${whereRaw}` : ''
  let total: number | undefined
  const countSql = `SELECT COUNT(*) FROM ${ident}${whereSql}`
  const countRes = await runQuery(connectionId, countSql, { silent: true })
  if (countRes.ok && countRes.rows?.[0]?.[0] != null) {
    total = Number(countRes.rows[0][0])
  }

  const dataSql = `SELECT * FROM ${ident}${whereSql} LIMIT ${limit} OFFSET ${offset}`
  const r = await runQuery(connectionId, dataSql, { silent: true })
  // Still push a history entry for the browse action
  if (!r.ok) {
    pushHistory({
      id: `${Date.now()}`,
      connectionId,
      sql: dataSql,
      createdAt: Date.now(),
      durationMs: r.durationMs,
      ok: false,
      error: r.error
    })
  } else {
    pushHistory({
      id: `${Date.now()}`,
      connectionId,
      sql: dataSql,
      createdAt: Date.now(),
      durationMs: r.durationMs,
      ok: true
    })
  }
  return { ...r, total }
}

export async function getTableSchema(
  connectionId: string,
  table: string
): Promise<{ ok: boolean; schema?: DbTableSchema; error?: string }> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, error: 'Connection not found' }
  if (profile.engine === 'redis') {
    return { ok: false, error: 'No schema for Redis' }
  }
  if (profile.engine === 'mongodb') {
    // Sample one doc for field names
    const r = await runQuery(
      connectionId,
      `db.${table}.find({}).limit(1)`,
      { silent: true }
    )
    if (!r.ok) return { ok: false, error: r.error }
    const columns: DbColumnInfo[] = (r.columns || []).map((name) => ({
      name,
      type: 'mixed',
      nullable: true
    }))
    return {
      ok: true,
      schema: { table, columns, indexes: [], foreignKeys: [] }
    }
  }

  try {
    if (profile.engine === 'postgres') {
      const parts = table.includes('.') ? table.split('.') : ['public', table]
      const schemaName = parts[0]
      const tableName = parts.slice(1).join('.')
      const escSchema = schemaName.replace(/'/g, "''")
      const escTable = tableName.replace(/'/g, "''")
      const cols = await runQuery(
        connectionId,
        `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default,
          CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_pk
         FROM information_schema.columns c
         LEFT JOIN information_schema.key_column_usage kcu
           ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name
           AND c.column_name = kcu.column_name
         LEFT JOIN information_schema.table_constraints tc
           ON kcu.constraint_name = tc.constraint_name
           AND kcu.table_schema = tc.table_schema
           AND tc.constraint_type = 'PRIMARY KEY'
         WHERE c.table_schema = '${escSchema}' AND c.table_name = '${escTable}'
         ORDER BY c.ordinal_position`,
        { silent: true }
      )
      if (!cols.ok) return { ok: false, error: cols.error }
      const columns: DbColumnInfo[] = (cols.rows || []).map((row) => ({
        name: String(row[0]),
        type: String(row[1]),
        nullable: String(row[2]).toUpperCase() === 'YES',
        defaultValue: row[3] == null ? null : String(row[3]),
        isPrimaryKey: row[4] === true || String(row[4]) === 'true'
      }))
      const idx = await runQuery(
        connectionId,
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = '${escSchema}' AND tablename = '${escTable}'`,
        { silent: true }
      )
      const indexes: DbIndexInfo[] = (idx.rows || []).map((row) => {
        const def = String(row[1] || '')
        const colsMatch = /\(([^)]+)\)/.exec(def)
        return {
          name: String(row[0]),
          columns: colsMatch
            ? colsMatch[1].split(',').map((s) => s.trim().replace(/"/g, ''))
            : [],
          unique: /unique/i.test(def)
        }
      })
      const fks = await runQuery(
        connectionId,
        `SELECT kcu.column_name, ccu.table_name, ccu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = '${escSchema}'
           AND tc.table_name = '${escTable}'`,
        { silent: true }
      )
      const foreignKeys = (fks.rows || []).map((row) => ({
        column: String(row[0]),
        refTable: String(row[1]),
        refColumn: String(row[2])
      }))
      return { ok: true, schema: { table, columns, indexes, foreignKeys } }
    }

    if (profile.engine === 'mysql') {
      const cols = await runQuery(
        connectionId,
        `SHOW FULL COLUMNS FROM ${quoteIdent('mysql', table)}`,
        { silent: true }
      )
      if (!cols.ok) return { ok: false, error: cols.error }
      // Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment
      const columns: DbColumnInfo[] = (cols.rows || []).map((row) => ({
        name: String(row[0]),
        type: String(row[1]),
        nullable: String(row[3]).toUpperCase() === 'YES',
        defaultValue: row[5] == null ? null : String(row[5]),
        isPrimaryKey: String(row[4]).toUpperCase() === 'PRI'
      }))
      const idx = await runQuery(
        connectionId,
        `SHOW INDEX FROM ${quoteIdent('mysql', table)}`,
        { silent: true }
      )
      const byName = new Map<string, DbIndexInfo>()
      for (const row of idx.rows || []) {
        const name = String(row[2])
        const col = String(row[4])
        const unique = Number(row[1]) === 0
        const existing = byName.get(name)
        if (existing) existing.columns.push(col)
        else byName.set(name, { name, columns: [col], unique })
      }
      return {
        ok: true,
        schema: {
          table,
          columns,
          indexes: Array.from(byName.values()),
          foreignKeys: []
        }
      }
    }

    // sqlite / libsql
    const cols = await runQuery(
      connectionId,
      `PRAGMA table_info(${quoteIdent(profile.engine, table)})`,
      { silent: true }
    )
    if (!cols.ok) return { ok: false, error: cols.error }
    // cid, name, type, notnull, dflt_value, pk
    const columns: DbColumnInfo[] = (cols.rows || []).map((row) => ({
      name: String(row[1]),
      type: String(row[2] || 'ANY'),
      nullable: Number(row[3]) === 0,
      defaultValue: row[4] == null ? null : String(row[4]),
      isPrimaryKey: Number(row[5]) > 0
    }))
    const idxList = await runQuery(
      connectionId,
      `PRAGMA index_list(${quoteIdent(profile.engine, table)})`,
      { silent: true }
    )
    const indexes: DbIndexInfo[] = []
    for (const row of idxList.rows || []) {
      const name = String(row[1])
      const unique = Number(row[2]) === 1
      const detail = await runQuery(
        connectionId,
        `PRAGMA index_info(${quoteIdent(profile.engine, name)})`,
        { silent: true }
      )
      indexes.push({
        name,
        unique,
        columns: (detail.rows || []).map((r) => String(r[2]))
      })
    }
    const fks = await runQuery(
      connectionId,
      `PRAGMA foreign_key_list(${quoteIdent(profile.engine, table)})`,
      { silent: true }
    )
    const foreignKeys = (fks.rows || []).map((row) => ({
      column: String(row[3]),
      refTable: String(row[2]),
      refColumn: String(row[4])
    }))
    return { ok: true, schema: { table, columns, indexes, foreignKeys } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function listSavedQueries(connectionId?: string): DbSavedQuery[] {
  if (!connectionId) return store.savedQueries
  return store.savedQueries.filter((q) => q.connectionId === connectionId)
}

export function saveSavedQuery(input: {
  id?: string
  connectionId: string
  label: string
  sql: string
}): DbSavedQuery[] {
  const now = Date.now()
  const id = input.id || randomUUID()
  const existing = store.savedQueries.find((q) => q.id === id)
  const next: DbSavedQuery = {
    id,
    connectionId: input.connectionId,
    label: input.label.trim() || 'Untitled',
    sql: input.sql,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
  const idx = store.savedQueries.findIndex((q) => q.id === id)
  if (idx >= 0) store.savedQueries[idx] = next
  else store.savedQueries.unshift(next)
  persist()
  return listSavedQueries(input.connectionId)
}

export function deleteSavedQuery(id: string): DbSavedQuery[] {
  const item = store.savedQueries.find((q) => q.id === id)
  store.savedQueries = store.savedQueries.filter((q) => q.id !== id)
  persist()
  return listSavedQueries(item?.connectionId)
}

function sqlLiteral(v: unknown): string {
  if (v == null) return 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'bigint') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

export async function getTableDdl(
  connectionId: string,
  table: string
): Promise<{ ok: boolean; ddl?: string; error?: string }> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, error: 'Connection not found' }
  if (profile.engine === 'redis' || profile.engine === 'mongodb') {
    return { ok: false, error: 'DDL not available for this engine' }
  }

  try {
    if (profile.engine === 'mysql') {
      const r = await runQuery(
        connectionId,
        `SHOW CREATE TABLE ${quoteIdent('mysql', table)}`,
        { silent: true }
      )
      if (!r.ok) return { ok: false, error: r.error }
      const ddl = r.rows?.[0]?.[1]
      return { ok: true, ddl: ddl != null ? String(ddl) : undefined }
    }

    if (profile.engine === 'sqlite' || profile.engine === 'libsql') {
      const r = await runQuery(
        connectionId,
        `SELECT sql FROM sqlite_master WHERE type='table' AND name=${sqlLiteral(table)}`,
        { silent: true }
      )
      if (!r.ok) return { ok: false, error: r.error }
      const ddl = r.rows?.[0]?.[0]
      return { ok: true, ddl: ddl != null ? String(ddl) : undefined }
    }

    // Postgres — synthesize CREATE from schema metadata
    const schema = await getTableSchema(connectionId, table)
    if (!schema.ok || !schema.schema) {
      return { ok: false, error: schema.error || 'No schema' }
    }
    const cols = schema.schema.columns
      .map((c) => {
        const parts = [
          quoteIdent('postgres', c.name),
          c.type || 'text',
          c.isPrimaryKey ? 'PRIMARY KEY' : '',
          !c.nullable && !c.isPrimaryKey ? 'NOT NULL' : '',
          c.defaultValue != null ? `DEFAULT ${c.defaultValue}` : ''
        ].filter(Boolean)
        return `  ${parts.join(' ')}`
      })
      .join(',\n')
    const fks = schema.schema.foreignKeys
      .map(
        (fk) =>
          `  FOREIGN KEY (${quoteIdent('postgres', fk.column)}) REFERENCES ${quoteIdent('postgres', fk.refTable)}(${quoteIdent('postgres', fk.refColumn)})`
      )
      .join(',\n')
    const ddl = `CREATE TABLE ${quoteIdent('postgres', table)} (\n${cols}${
      fks ? `,\n${fks}` : ''
    }\n);`
    return { ok: true, ddl }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateTableCell(
  connectionId: string,
  input: {
    table: string
    pkColumn: string
    pkValue: unknown
    column: string
    value: unknown
  }
): Promise<{
  ok: boolean
  durationMs: number
  error?: string
}> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, durationMs: 0, error: 'Connection not found' }
  if (profile.readOnly) {
    return {
      ok: false,
      durationMs: 0,
      error: 'Connection is in read-only mode'
    }
  }
  if (
    profile.engine === 'redis' ||
    profile.engine === 'mongodb'
  ) {
    return {
      ok: false,
      durationMs: 0,
      error: 'Cell edit is for SQL engines'
    }
  }
  const t = quoteIdent(profile.engine, input.table)
  const col = quoteIdent(profile.engine, input.column)
  const pk = quoteIdent(profile.engine, input.pkColumn)
  const sql = `UPDATE ${t} SET ${col} = ${sqlLiteral(input.value)} WHERE ${pk} = ${sqlLiteral(input.pkValue)}`
  return runQuery(connectionId, sql, { allowDestructive: true })
}

export async function insertTableRow(
  connectionId: string,
  input: {
    table: string
    columns: string[]
    values: unknown[]
  }
): Promise<{
  ok: boolean
  durationMs: number
  error?: string
}> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, durationMs: 0, error: 'Connection not found' }
  if (profile.readOnly) {
    return {
      ok: false,
      durationMs: 0,
      error: 'Connection is in read-only mode'
    }
  }
  if (
    profile.engine === 'redis' ||
    profile.engine === 'mongodb'
  ) {
    return {
      ok: false,
      durationMs: 0,
      error: 'Insert row is for SQL engines'
    }
  }
  const t = quoteIdent(profile.engine, input.table)
  if (input.columns.length === 0) {
    const sql =
      profile.engine === 'mysql'
        ? `INSERT INTO ${t} () VALUES ()`
        : `INSERT INTO ${t} DEFAULT VALUES`
    return runQuery(connectionId, sql, { allowDestructive: true })
  }
  if (input.columns.length !== input.values.length) {
    return { ok: false, durationMs: 0, error: 'Columns/values mismatch' }
  }
  const cols = input.columns.map((c) => quoteIdent(profile.engine, c)).join(', ')
  const vals = input.values.map(sqlLiteral).join(', ')
  const sql = `INSERT INTO ${t} (${cols}) VALUES (${vals})`
  return runQuery(connectionId, sql, { allowDestructive: true })
}

export async function importCsv(
  connectionId: string,
  input: {
    table: string
    columns: string[]
    rows: unknown[][]
    /** Skip header row already stripped by client. */
    batchSize?: number
  }
): Promise<{
  ok: boolean
  inserted: number
  durationMs: number
  error?: string
}> {
  const started = Date.now()
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) {
    return { ok: false, inserted: 0, durationMs: 0, error: 'Connection not found' }
  }
  if (profile.readOnly) {
    return {
      ok: false,
      inserted: 0,
      durationMs: 0,
      error: 'Connection is in read-only mode'
    }
  }
  if (
    profile.engine === 'redis' ||
    profile.engine === 'mongodb'
  ) {
    return {
      ok: false,
      inserted: 0,
      durationMs: 0,
      error: 'CSV import is for SQL engines'
    }
  }
  if (!input.columns.length) {
    return { ok: false, inserted: 0, durationMs: 0, error: 'No columns' }
  }
  const t = quoteIdent(profile.engine, input.table)
  const cols = input.columns.map((c) => quoteIdent(profile.engine, c)).join(', ')
  const batch = Math.max(1, Math.min(input.batchSize ?? 100, 500))
  let inserted = 0
  try {
    for (let i = 0; i < input.rows.length; i += batch) {
      const chunk = input.rows.slice(i, i + batch)
      const valuesSql = chunk
        .map((row) => {
          const vals = input.columns.map((_, ci) => {
            const v = row[ci]
            if (v == null || v === '') return 'NULL'
            return sqlLiteral(v)
          })
          return `(${vals.join(', ')})`
        })
        .join(',\n')
      const sql = `INSERT INTO ${t} (${cols}) VALUES ${valuesSql}`
      const r = await runQuery(connectionId, sql, {
        silent: true,
        allowDestructive: true
      })
      if (!r.ok) {
        return {
          ok: false,
          inserted,
          durationMs: Date.now() - started,
          error: r.error || 'Insert batch failed'
        }
      }
      inserted += chunk.length
    }
    pushHistory({
      id: `${Date.now()}`,
      connectionId,
      sql: `IMPORT CSV → ${input.table} (${inserted} rows)`,
      createdAt: Date.now(),
      durationMs: Date.now() - started,
      ok: true
    })
    return { ok: true, inserted, durationMs: Date.now() - started }
  } catch (e) {
    return {
      ok: false,
      inserted,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function browseRedisKeys(
  connectionId: string,
  opts: { pattern?: string; count?: number } = {}
): Promise<{
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs: number
  error?: string
}> {
  const started = Date.now()
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile || profile.engine !== 'redis') {
    return { ok: false, durationMs: 0, error: 'Not a Redis connection' }
  }
  if (!live.has(connectionId)) {
    const r = await connect(connectionId)
    if (!r.ok) return { ok: false, durationMs: 0, error: r.error }
  }
  try {
    const redis = live.get(connectionId) as RedisClientType
    const pattern = opts.pattern?.trim() || '*'
    const limit = Math.max(1, Math.min(opts.count ?? 200, 2000))
    const keys: string[] = []
    // SCAN to avoid blocking KEYS on large DBs (iterator yields key batches)
    for await (const batch of redis.scanIterator({
      MATCH: pattern,
      COUNT: 100
    })) {
      const list = Array.isArray(batch) ? batch : [batch]
      for (const key of list) {
        keys.push(String(key))
        if (keys.length >= limit) break
      }
      if (keys.length >= limit) break
    }
    const rows: unknown[][] = []
    for (const key of keys) {
      const type = await redis.type(key)
      const ttl = await redis.ttl(key)
      let preview: string | null = null
      if (type === 'string') {
        const v = await redis.get(key)
        preview = v == null ? null : v.length > 120 ? `${v.slice(0, 120)}…` : v
      } else if (type === 'hash') {
        const len = await redis.hLen(key)
        preview = `hash(${len})`
      } else if (type === 'list') {
        const len = await redis.lLen(key)
        preview = `list(${len})`
      } else if (type === 'set') {
        const len = await redis.sCard(key)
        preview = `set(${len})`
      } else if (type === 'zset') {
        const len = await redis.zCard(key)
        preview = `zset(${len})`
      } else {
        preview = type
      }
      rows.push([key, type, ttl, preview])
    }
    return {
      ok: true,
      columns: ['key', 'type', 'ttl', 'preview'],
      rows,
      durationMs: Date.now() - started
    }
  } catch (e) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function getRedisKey(
  connectionId: string,
  key: string
): Promise<{
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs: number
  error?: string
}> {
  const started = Date.now()
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile || profile.engine !== 'redis') {
    return { ok: false, durationMs: 0, error: 'Not a Redis connection' }
  }
  if (!live.has(connectionId)) {
    const r = await connect(connectionId)
    if (!r.ok) return { ok: false, durationMs: 0, error: r.error }
  }
  try {
    const redis = live.get(connectionId) as RedisClientType
    const type = await redis.type(key)
    const ttl = await redis.ttl(key)
    let columns = ['field', 'value']
    let rows: unknown[][] = []
    if (type === 'string') {
      columns = ['key', 'type', 'ttl', 'value']
      rows = [[key, type, ttl, await redis.get(key)]]
    } else if (type === 'hash') {
      const all = await redis.hGetAll(key)
      rows = Object.entries(all).map(([f, v]) => [f, v])
    } else if (type === 'list') {
      const items = await redis.lRange(key, 0, 499)
      columns = ['index', 'value']
      rows = items.map((v, i) => [i, v])
    } else if (type === 'set') {
      const members = await redis.sMembers(key)
      columns = ['member']
      rows = members.slice(0, 500).map((m) => [m])
    } else if (type === 'zset') {
      const members = await redis.zRangeWithScores(key, 0, 499)
      columns = ['member', 'score']
      rows = members.map((m) => [m.value, m.score])
    } else {
      columns = ['key', 'type', 'ttl']
      rows = [[key, type, ttl]]
    }
    return { ok: true, columns, rows, durationMs: Date.now() - started }
  } catch (e) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}
