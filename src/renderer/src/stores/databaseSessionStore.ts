import { create } from 'zustand'
import type { DbAccessInfo, DbTableSchema } from '../../../shared/types'

export type DbQueryResult = {
  ok: boolean
  columns?: string[]
  rows?: unknown[][]
  durationMs?: number
  error?: string
}

export type DbSqlResultTab = {
  id: string
  label: string
  sql: string
  result: DbQueryResult | null
}

export type DbConnectionWorkspace = {
  sql: string
  sqlResultTabs: DbSqlResultTab[]
  activeResultTabId: string | null
  sqlTab: 'results' | 'messages'
  selectedTable: string | null
  whereClause: string
  limit: number
  tablePage: number
  tableFilter: string
  tableResult: DbQueryResult | null
  tableTotal: number | undefined
  tableSchema: DbTableSchema | null
  schemaOpen: boolean
  selectedRow: number | null
  sqlParams: Record<string, string>
  redisPattern: string
  historyFilter: 'all' | 'ok' | 'fail'
  historyQuery: string
  selectedHistoryId: string | null
  saveLabel: string
}

function emptyWorkspace(): DbConnectionWorkspace {
  return {
    sql: '',
    sqlResultTabs: [],
    activeResultTabId: null,
    sqlTab: 'results',
    selectedTable: null,
    whereClause: '',
    limit: 50,
    tablePage: 0,
    tableFilter: '',
    tableResult: null,
    tableTotal: undefined,
    tableSchema: null,
    schemaOpen: true,
    selectedRow: null,
    sqlParams: {},
    redisPattern: '*',
    historyFilter: 'all',
    historyQuery: '',
    selectedHistoryId: null,
    saveLabel: ''
  }
}

interface DatabaseSessionState {
  connectedIds: Set<string>
  accessById: Record<string, DbAccessInfo>
  /** True while creating a new connection profile (keeps last connectionId in nav). */
  draftingNew: boolean
  workspaces: Record<string, DbConnectionWorkspace>

  markConnected: (id: string, access?: DbAccessInfo) => void
  markDisconnected: (id: string) => void
  setConnectedIds: (ids: Iterable<string>) => void
  setAccess: (id: string, info: DbAccessInfo) => void
  removeConnection: (id: string) => void
  setDraftingNew: (value: boolean) => void
  getWorkspace: (connectionId: string) => DbConnectionWorkspace
  patchWorkspace: (
    connectionId: string,
    patch: Partial<DbConnectionWorkspace>
  ) => void
  clearWorkspace: (connectionId: string) => void
}

export const useDatabaseSessionStore = create<DatabaseSessionState>(
  (set, get) => ({
    connectedIds: new Set(),
    accessById: {},
    draftingNew: false,
    workspaces: {},

    markConnected: (id, access) =>
      set((s) => {
        const connectedIds = new Set(s.connectedIds)
        connectedIds.add(id)
        return {
          connectedIds,
          accessById: access
            ? { ...s.accessById, [id]: access }
            : s.accessById
        }
      }),

    markDisconnected: (id) =>
      set((s) => {
        const connectedIds = new Set(s.connectedIds)
        connectedIds.delete(id)
        const { [id]: _removed, ...accessById } = s.accessById
        return { connectedIds, accessById }
      }),

    setConnectedIds: (ids) => set({ connectedIds: new Set(ids) }),

    setAccess: (id, info) =>
      set((s) => ({ accessById: { ...s.accessById, [id]: info } })),

    removeConnection: (id) =>
      set((s) => {
        const connectedIds = new Set(s.connectedIds)
        connectedIds.delete(id)
        const { [id]: _a, ...accessById } = s.accessById
        const { [id]: _w, ...workspaces } = s.workspaces
        return { connectedIds, accessById, workspaces }
      }),

    setDraftingNew: (value) => set({ draftingNew: value }),

    getWorkspace: (connectionId) => {
      const existing = get().workspaces[connectionId]
      if (existing) return existing
      const created = emptyWorkspace()
      set((s) => ({
        workspaces: { ...s.workspaces, [connectionId]: created }
      }))
      return created
    },

    patchWorkspace: (connectionId, patch) =>
      set((s) => {
        const prev = s.workspaces[connectionId] ?? emptyWorkspace()
        return {
          workspaces: {
            ...s.workspaces,
            [connectionId]: { ...prev, ...patch }
          }
        }
      }),

    clearWorkspace: (connectionId) =>
      set((s) => {
        const { [connectionId]: _removed, ...workspaces } = s.workspaces
        return { workspaces }
      })
  })
)
