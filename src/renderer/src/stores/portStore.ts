import { create } from 'zustand'
import Fuse from 'fuse.js'
import type { PortInfo, PortView, ProcessDetails, ActionHistoryItem } from '../../../shared/types'
import { useSettingsStore } from './settingsStore'
import { useUIStore } from './uiStore'
import {
  recordOccupancy,
  type OccupancyMap
} from '../lib/portOccupancy'

interface PortState {
  ports: PortInfo[]
  filteredPorts: PortInfo[]
  selectedPids: Set<number>
  selectedIndex: number
  searchQuery: string
  sortBy: keyof PortInfo
  sortDirection: 'asc' | 'desc'
  processDetails: ProcessDetails | null
  history: ActionHistoryItem[]
  tags: Record<number, string[]>
  isLoading: boolean
  profileFilter: number[]
  groupByProject: boolean
  occupancy: OccupancyMap
  waitingPort: number | null
  waitPort: (port: number | null) => void
  portView: PortView

  setPorts: (ports: PortInfo[]) => void
  setProfileFilter: (ports: number[]) => void
  setSearchQuery: (query: string) => void
  setSortBy: (key: keyof PortInfo) => void
  setGroupByProject: (value: boolean) => void
  setPortView: (view: PortView) => void
  selectPort: (pid: number) => void
  togglePortSelection: (pid: number) => void
  selectAll: () => void
  clearSelection: () => void
  moveSelection: (direction: 'up' | 'down') => void

  fetchPorts: () => Promise<void>
  fetchProcessDetails: (pid: number) => Promise<void>
  killSelected: () => Promise<void>
  killPort: (pid: number) => Promise<boolean>
  restartPort: (
    pid: number,
    projectPath?: string
  ) => Promise<{ success: boolean; error?: string; hint?: string }>
  openInBrowser: (port: number) => Promise<void>
  openInTerminal: (pid: number, projectPath?: string) => Promise<void>
  openInVSCode: (pid: number, projectPath?: string) => Promise<void>

  addTag: (port: number, tag: string) => void
  removeTag: (port: number, tag: string) => void
  addHistory: (item: Omit<ActionHistoryItem, 'id' | 'timestamp'>) => void
  clearHistory: () => void
  reapplyFiltersAndSort: () => void
}

function filterPorts(
  ports: PortInfo[],
  query: string,
  tags: Record<number, string[]>
): PortInfo[] {
  const portsWithTags = ports.map((p) => ({
    ...p,
    tags: tags[p.port] || []
  }))

  if (!query) return portsWithTags

  const fuse = new Fuse(portsWithTags, {
    keys: [
      { name: 'port', getFn: (p) => p.port.toString() },
      'command',
      'user',
      { name: 'pid', getFn: (p) => p.pid.toString() },
      'projectName',
      'tags',
      'peerAddress',
      { name: 'peerPort', getFn: (p) => (p.peerPort ? String(p.peerPort) : '') }
    ],
    threshold: 0.35
  })

  return fuse.search(query).map((r) => r.item)
}

function applyProfileFilter(
  ports: PortInfo[],
  profileFilter: number[]
): PortInfo[] {
  if (profileFilter.length === 0) return ports
  return ports.filter((p) => profileFilter.includes(p.port))
}

function applyHideSystem(ports: PortInfo[]): PortInfo[] {
  if (!useSettingsStore.getState().hideSystemProcesses) return ports
  return ports.filter((p) => !p.isSystem)
}

function applyPortView(ports: PortInfo[], view: PortView): PortInfo[] {
  if (view === 'connections') {
    return ports.filter((p) => p.role === 'connection')
  }
  return ports.filter((p) => p.role !== 'connection')
}

function pipeline(
  ports: PortInfo[],
  query: string,
  tags: Record<number, string[]>,
  profileFilter: number[],
  portView: PortView
): PortInfo[] {
  let filtered = filterPorts(ports, query, tags)
  filtered = applyProfileFilter(filtered, profileFilter)
  filtered = applyHideSystem(filtered)
  return applyPortView(filtered, portView)
}

function sortPortsWithImportance(
  ports: PortInfo[],
  favoritePorts: number[],
  sortBy: keyof PortInfo,
  direction: 'asc' | 'desc'
): PortInfo[] {
  const fav = new Set(favoritePorts)
  const tier = (p: PortInfo) => {
    if (fav.has(p.port)) return 0
    if (!p.isCritical) return 1
    return 2
  }
  return [...ports].sort((a, b) => {
    const ta = tier(a)
    const tb = tier(b)
    if (ta !== tb) return ta - tb
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    const cmp =
      typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal))
    return direction === 'asc' ? cmp : -cmp
  })
}

function getFavoritePortsForSort(): number[] {
  const { activeProfileId, profiles } = useSettingsStore.getState()
  if (activeProfileId == null) return []
  return profiles.find((p) => p.id === activeProfileId)?.favoritePorts ?? []
}

/** Stable signature so identical poll results don't rebuild filteredPorts. */
function portsSignature(ports: PortInfo[]): string {
  return ports
    .map(
      (p) =>
        `${p.pid}:${p.port}:${p.command}:${p.cpu}:${p.memory}:${p.memoryRSS}:${p.projectPath}:${p.role}:${p.peerAddress}:${p.peerPort}:${p.connectionCount}`
    )
    .join('|')
}

function applySorted(
  filtered: PortInfo[],
  sortBy: keyof PortInfo,
  sortDirection: 'asc' | 'desc'
): PortInfo[] {
  return sortPortsWithImportance(
    filtered,
    getFavoritePortsForSort(),
    sortBy,
    sortDirection
  )
}

export const usePortStore = create<PortState>((set, get) => ({
  ports: [],
  filteredPorts: [],
  selectedPids: new Set(),
  selectedIndex: -1,
  searchQuery: '',
  sortBy: 'port',
  sortDirection: 'asc',
  processDetails: null,
  history: [],
  tags: {},
  isLoading: false,
  profileFilter: [],
  groupByProject: false,
  occupancy: {},
  waitingPort: null,
  waitPort: (port) => {
    if (port == null) {
      set({ waitingPort: null })
      return
    }
    const up = get().ports.some(
      (p) => p.role !== 'connection' && p.port === port
    )
    if (up) {
      set({ waitingPort: null })
      const settings = useSettingsStore.getState()
      useUIStore.getState().addToast({
        type: 'success',
        title: `:${port} is already up`,
        message: settings.waitOpenBrowser ? 'Opening in the browser' : undefined
      })
      if (settings.waitOpenBrowser) void get().openInBrowser(port)
      return
    }
    set({ waitingPort: port })
    useUIStore.getState().addToast({
      type: 'info',
      title: `Waiting for :${port}`,
      message: 'A toast fires when that port starts listening'
    })
  },
  portView: 'listen',

  setPorts: (ports) => {
    const occupancy = recordOccupancy(
      get().occupancy,
      ports.filter((p) => p.role !== 'connection')
    )
    const prev = get().ports
    if (
      prev.length === ports.length &&
      portsSignature(prev) === portsSignature(ports)
    ) {
      set({ occupancy })
      return
    }
    const { searchQuery, sortBy, sortDirection, tags, profileFilter, portView } = get()
    const filtered = pipeline(ports, searchQuery, tags, profileFilter, portView)
    set({
      ports,
      occupancy,
      filteredPorts: applySorted(filtered, sortBy, sortDirection)
    })
    const waiting = get().waitingPort
    if (waiting != null) {
      const up = ports.some(
        (p) => p.role !== 'connection' && p.port === waiting
      )
      if (up) {
        set({ waitingPort: null })
        const settings = useSettingsStore.getState()
        useUIStore.getState().addToast({
          type: 'success',
          title: `:${waiting} is up`,
          message: settings.waitOpenBrowser
            ? 'Opening in the browser'
            : 'Port is listening'
        })
        if (settings.waitOpenBrowser) void get().openInBrowser(waiting)
      }
    }
  },

  setProfileFilter: (portNumbers) => {
    const { ports, searchQuery, sortBy, sortDirection, tags, portView } = get()
    const filtered = pipeline(ports, searchQuery, tags, portNumbers, portView)
    set({
      profileFilter: portNumbers,
      filteredPorts: applySorted(filtered, sortBy, sortDirection)
    })
  },

  setSearchQuery: (query) => {
    const { ports, sortBy, sortDirection, tags, profileFilter, portView } = get()
    const filtered = pipeline(ports, query, tags, profileFilter, portView)
    set({
      searchQuery: query,
      filteredPorts: applySorted(filtered, sortBy, sortDirection),
      selectedIndex: filtered.length > 0 ? 0 : -1
    })
  },

  setSortBy: (key) => {
    const { filteredPorts, sortBy, sortDirection } = get()
    const newDirection = sortBy === key && sortDirection === 'asc' ? 'desc' : 'asc'
    set({
      sortBy: key,
      sortDirection: newDirection,
      filteredPorts: applySorted(filteredPorts, key, newDirection)
    })
  },

  setGroupByProject: (value) => set({ groupByProject: value }),

  setPortView: (view) => {
    const { ports, searchQuery, sortBy, sortDirection, tags, profileFilter } = get()
    const filtered = pipeline(ports, searchQuery, tags, profileFilter, view)
    set({
      portView: view,
      filteredPorts: applySorted(filtered, sortBy, sortDirection),
      selectedIndex: filtered.length > 0 ? 0 : -1,
      selectedPids: new Set()
    })
  },

  selectPort: (pid) => {
    const { filteredPorts } = get()
    const idx = filteredPorts.findIndex((p) => p.pid === pid)
    set({
      selectedPids: new Set([pid]),
      ...(idx >= 0 ? { selectedIndex: idx } : {})
    })
  },

  togglePortSelection: (pid) => {
    const { selectedPids } = get()
    const next = new Set(selectedPids)
    if (next.has(pid)) next.delete(pid)
    else next.add(pid)
    set({ selectedPids: next })
  },

  selectAll: () => {
    const { filteredPorts } = get()
    set({ selectedPids: new Set(filteredPorts.map((p) => p.pid)) })
  },

  clearSelection: () => set({ selectedPids: new Set(), selectedIndex: -1 }),

  moveSelection: (direction) => {
    const { filteredPorts, selectedIndex } = get()
    if (filteredPorts.length === 0) return
    const next =
      direction === 'up'
        ? Math.max(0, selectedIndex - 1)
        : Math.min(filteredPorts.length - 1, selectedIndex + 1)
    set({ selectedIndex: next })
  },

  fetchPorts: async () => {
    set({ isLoading: true })
    try {
      const ports = await window.api.getPorts()
      get().setPorts(ports)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchProcessDetails: async (pid) => {
    // Clear first so QuickPeek never briefly shows a previous PID's details.
    set({ processDetails: null })
    const details = await window.api.getProcessDetails(pid)
    // Drop stale responses: if another fetch started for a different pid,
    // the returned details won't match (or will be null).
    if (details && details.pid !== pid) return
    set({ processDetails: details })
  },

  killSelected: async () => {
    const { selectedPids, fetchPorts, addHistory, filteredPorts } = get()
    const pids = Array.from(selectedPids)
    await window.api.killProcesses(pids)
    for (const pid of pids) {
      const port = filteredPorts.find((p) => p.pid === pid)
      addHistory({
        action: 'kill',
        pid,
        port: port?.port,
        command: port?.command
      })
    }
    set({ selectedPids: new Set() })
    setTimeout(fetchPorts, 500)
  },

  killPort: async (pid) => {
    const { fetchPorts, addHistory, filteredPorts } = get()
    const success = await window.api.killProcess(pid)
    if (success) {
      const port = filteredPorts.find((p) => p.pid === pid)
      addHistory({
        action: 'kill',
        pid,
        port: port?.port,
        command: port?.command
      })
      setTimeout(fetchPorts, 500)
    }
    return success
  },

  restartPort: async (pid, projectPath) => {
    const { fetchPorts, addHistory, filteredPorts } = get()
    const result = await window.api.restartProcess(pid, projectPath)
    if (result.success) {
      const port = filteredPorts.find((p) => p.pid === pid)
      addHistory({
        action: 'restart',
        pid,
        port: port?.port,
        command: port?.command
      })
      setTimeout(fetchPorts, 2000)
    }
    return result
  },

  openInBrowser: async (port) => {
    await window.api.openInBrowser(port)
    get().addHistory({ action: 'open-browser', port })
  },

  openInTerminal: async (pid, projectPath) => {
    const result = await window.api.openInTerminal(pid, projectPath)
    get().addHistory({ action: 'open-terminal', pid })
    useUIStore.getState().addToast({
      type: result.ok ? (result.method === 'focused-tab' ? 'success' : 'info') : 'error',
      title: result.ok ? 'Terminal' : 'Terminal failed',
      message: result.message
    })
  },

  openInVSCode: async (pid, projectPath) => {
    await window.api.openInVSCode(pid, projectPath)
    get().addHistory({ action: 'open-vscode', pid })
  },

  addTag: (port, tag) => {
    const { tags, ports, searchQuery, sortBy, sortDirection, profileFilter, portView } = get()
    const portTags = [...(tags[port] || []), tag]
    const newTags = { ...tags, [port]: [...new Set(portTags)] }
    const filtered = pipeline(ports, searchQuery, newTags, profileFilter, portView)
    set({
      tags: newTags,
      filteredPorts: applySorted(filtered, sortBy, sortDirection)
    })
  },

  removeTag: (port, tag) => {
    const { tags, ports, searchQuery, sortBy, sortDirection, profileFilter, portView } = get()
    const newTags = {
      ...tags,
      [port]: (tags[port] || []).filter((t) => t !== tag)
    }
    const filtered = pipeline(ports, searchQuery, newTags, profileFilter, portView)
    set({
      tags: newTags,
      filteredPorts: applySorted(filtered, sortBy, sortDirection)
    })
  },

  addHistory: (item) => {
    const { history } = get()
    set({
      history: [
        { ...item, id: crypto.randomUUID(), timestamp: Date.now() },
        ...history.slice(0, 49)
      ]
    })
  },

  clearHistory: () => set({ history: [] }),

  reapplyFiltersAndSort: () => {
    const { ports, searchQuery, sortBy, sortDirection, tags, profileFilter, portView } =
      get()
    const filtered = pipeline(ports, searchQuery, tags, profileFilter, portView)
    set({ filteredPorts: applySorted(filtered, sortBy, sortDirection) })
  }
}))
