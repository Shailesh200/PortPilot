import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync
} from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import postgres from 'postgres'
import mysql from 'mysql2/promise'
import { createClient, type RedisClientType } from 'redis'

export type DbEngine = 'postgres' | 'mysql' | 'sqlite' | 'redis'

export interface DbConnectionProfile {
  id: string
  name: string
  engine: DbEngine
  host?: string
  port?: number
  database?: string
  user?: string
  passwordEnc?: string
  filePath?: string
  ssl?: boolean
}

export interface QueryHistoryItem {
  id: string
  connectionId: string
  sql: string
  createdAt: number
  durationMs?: number
  ok: boolean
  error?: string
}

interface StoreFile {
  connections: DbConnectionProfile[]
  history: QueryHistoryItem[]
}

let store: StoreFile = { connections: [], history: [] }
const live = new Map<string, unknown>()

function storePath(): string {
  return join(app.getPath('userData'), 'db-connections.json')
}

function persist(): void {
  try {
    const dir = app.getPath('userData')
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
  try {
    if (existsSync(storePath())) {
      store = JSON.parse(readFileSync(storePath(), 'utf-8')) as StoreFile
      if (!Array.isArray(store.connections)) store.connections = []
      if (!Array.isArray(store.history)) store.history = []
    }
  } catch {
    store = { connections: [], history: [] }
  }
  return store
}

function encryptSecret(plain: string): string {
  if (!plain) return ''
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plain).toString('base64')
  }
  return `plain:${Buffer.from(plain, 'utf-8').toString('base64')}`
}

function decryptSecret(enc?: string): string {
  if (!enc) return ''
  if (enc.startsWith('plain:')) {
    return Buffer.from(enc.slice(6), 'base64').toString('utf-8')
  }
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  }
  return ''
}

export function listConnections(): Omit<DbConnectionProfile, 'passwordEnc'>[] {
  return store.connections.map(({ passwordEnc: _, ...rest }) => rest)
}

export function saveConnection(
  profile: DbConnectionProfile & { password?: string }
): void {
  const { password, ...rest } = profile
  const next: DbConnectionProfile = {
    ...rest,
    passwordEnc:
      password !== undefined
        ? encryptSecret(password)
        : store.connections.find((c) => c.id === profile.id)?.passwordEnc
  }
  const idx = store.connections.findIndex((c) => c.id === next.id)
  if (idx >= 0) store.connections[idx] = next
  else store.connections.push(next)
  persist()
}

export function deleteConnection(id: string): void {
  store.connections = store.connections.filter((c) => c.id !== id)
  store.history = store.history.filter((h) => h.connectionId !== id)
  void disconnect(id)
  persist()
}

export async function connect(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = store.connections.find((c) => c.id === id)
  if (!profile) return { ok: false, error: 'Connection not found' }
  try {
    await disconnect(id)
    const password = decryptSecret(profile.passwordEnc)
    switch (profile.engine) {
      case 'postgres': {
        const sql = postgres({
          host: profile.host || 'localhost',
          port: profile.port || 5432,
          database: profile.database || 'postgres',
          username: profile.user || 'postgres',
          password,
          ssl: profile.ssl ? 'require' : false,
          max: 1
        })
        await sql`select 1`
        live.set(id, sql)
        break
      }
      case 'mysql': {
        const conn = await mysql.createConnection({
          host: profile.host || 'localhost',
          port: profile.port || 3306,
          database: profile.database,
          user: profile.user,
          password,
          ssl: profile.ssl ? {} : undefined
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
        const client = createClient({
          socket: {
            host: profile.host || '127.0.0.1',
            port: profile.port || 6379,
            tls: profile.ssl || undefined
          },
          password: password || undefined
        })
        await client.connect()
        await client.ping()
        live.set(id, client)
        break
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function disconnect(id: string): Promise<void> {
  const c = live.get(id)
  if (!c) return
  live.delete(id)
  try {
    if (
      c &&
      typeof c === 'object' &&
      'kind' in c &&
      (c as { kind: string }).kind === 'sqlite'
    ) {
      const wrap = c as unknown as {
        db: { export: () => Uint8Array; close: () => void }
        file?: string
      }
      if (wrap.file) {
        writeFileSync(wrap.file, Buffer.from(wrap.db.export()))
      }
      wrap.db.close()
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

export async function runQuery(
  connectionId: string,
  sqlText: string
): Promise<{
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs: number
  error?: string
}> {
  const started = Date.now()
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) {
    return { ok: false, durationMs: 0, error: 'Connection not found' }
  }
  if (!live.has(connectionId)) {
    const r = await connect(connectionId)
    if (!r.ok) return { ok: false, durationMs: 0, error: r.error }
  }
  try {
    let columns: string[] = []
    let rows: unknown[][] = []
    const client = live.get(connectionId)
    switch (profile.engine) {
      case 'postgres': {
        const sqlTag = client as ReturnType<typeof postgres>
        const result = await sqlTag.unsafe(sqlText)
        columns = result.columns?.map((c) => c.name) || []
        rows = result.map((row) =>
          columns.map((c) => (row as Record<string, unknown>)[c])
        )
        break
      }
      case 'mysql': {
        const conn = client as mysql.Connection
        const [res, fields] = await conn.query(sqlText)
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
        const exec = wrap.db.exec(sqlText)
        if (exec[0]) {
          columns = exec[0].columns
          rows = exec[0].values
        }
        break
      }
      case 'redis': {
        const redis = client as RedisClientType
        const parts = sqlText.trim().split(/\s+/)
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
    }
    const durationMs = Date.now() - started
    pushHistory({
      id: `${Date.now()}`,
      connectionId,
      sql: sqlText,
      createdAt: Date.now(),
      durationMs,
      ok: true
    })
    return { ok: true, columns, rows, durationMs }
  } catch (e) {
    const durationMs = Date.now() - started
    const error = e instanceof Error ? e.message : String(e)
    pushHistory({
      id: `${Date.now()}`,
      connectionId,
      sql: sqlText,
      createdAt: Date.now(),
      durationMs,
      ok: false,
      error
    })
    return { ok: false, durationMs, error }
  }
}

function pushHistory(item: QueryHistoryItem): void {
  store.history = [item, ...store.history].slice(0, 200)
  persist()
}

export function getQueryHistory(connectionId?: string): QueryHistoryItem[] {
  if (!connectionId) return store.history
  return store.history.filter((h) => h.connectionId === connectionId)
}

export async function listTables(
  connectionId: string
): Promise<{ ok: boolean; tables?: string[]; error?: string }> {
  const profile = store.connections.find((c) => c.id === connectionId)
  if (!profile) return { ok: false, error: 'Not found' }
  if (profile.engine === 'redis') {
    return { ok: true, tables: ['(use KEYS * in SQL editor)'] }
  }
  let sql = ''
  if (profile.engine === 'postgres') {
    sql =
      "select table_name from information_schema.tables where table_schema='public' order by 1"
  } else if (profile.engine === 'mysql') {
    sql = 'show tables'
  } else {
    sql = "select name from sqlite_master where type='table' order by 1"
  }
  const r = await runQuery(connectionId, sql)
  if (!r.ok) return { ok: false, error: r.error }
  return {
    ok: true,
    tables: (r.rows || []).map((row) => String(row[0]))
  }
}
