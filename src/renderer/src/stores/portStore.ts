import { create } from 'zustand'
import Fuse from 'fuse.js'
import type { PortInfo, ProcessDetails, ActionHistoryItem } from '../../../shared/types'

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

  setPorts: (ports: PortInfo[]) => void
  setProfileFilter: (ports: number[]) => void
  setSearchQuery: (query: string) => void
  setSortBy: (key: keyof PortInfo) => void
  selectPort: (pid: number) => void
  togglePortSelection: (pid: number) => void
  selectAll: () => void
  clearSelection: () => void
  moveSelection: (direction: 'up' | 'down') => void

  fetchPorts: () => Promise<void>
  fetchProcessDetails: (pid: number) => Promise<void>
  killSelected: () => Promise<void>
  killPort: (pid: number) => Promise<boolean>
  restartPort: (pid: number, projectPath?: string) => Promise<{ success: boolean; error?: string }>
  openInBrowser: (port: number) => Promise<void>
  openInTerminal: (pid: number, projectPath?: string) => Promise<void>
  openInVSCode: (pid: number, projectPath?: string) => Promise<void>

  addTag: (port: number, tag: string) => void
  removeTag: (port: number, tag: string) => void
  addHistory: (item: Omit<ActionHistoryItem, 'id' | 'timestamp'>) => void
  clearHistory: () => void
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
      'tags'
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

function sortPorts(
  ports: PortInfo[],
  sortBy: keyof PortInfo,
  direction: 'asc' | 'desc'
): PortInfo[] {
  return [...ports].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    const cmp =
      typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal))
    return direction === 'asc' ? cmp : -cmp
  })
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

  setPorts: (ports) => {
    const { searchQuery, sortBy, sortDirection, tags, profileFilter } = get()
    let filtered = filterPorts(ports, searchQuery, tags)
    filtered = applyProfileFilter(filtered, profileFilter)
    set({ ports, filteredPorts: sortPorts(filtered, sortBy, sortDirection) })
  },

  setProfileFilter: (portNumbers) => {
    const { ports, searchQuery, sortBy, sortDirection, tags } = get()
    set({ profileFilter: portNumbers })
    let filtered = filterPorts(ports, searchQuery, tags)
    if (portNumbers.length > 0) {
      filtered = filtered.filter((p) => portNumbers.includes(p.port))
    }
    set({ filteredPorts: sortPorts(filtered, sortBy, sortDirection) })
  },

  setSearchQuery: (query) => {
    const { ports, sortBy, sortDirection, tags, profileFilter } = get()
    let filtered = filterPorts(ports, query, tags)
    filtered = applyProfileFilter(filtered, profileFilter)
    set({
      searchQuery: query,
      filteredPorts: sortPorts(filtered, sortBy, sortDirection),
      selectedIndex: filtered.length > 0 ? 0 : -1
    })
  },

  setSortBy: (key) => {
    const { filteredPorts, sortBy, sortDirection } = get()
    const newDirection = sortBy === key && sortDirection === 'asc' ? 'desc' : 'asc'
    set({
      sortBy: key,
      sortDirection: newDirection,
      filteredPorts: sortPorts(filteredPorts, key, newDirection)
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

  clearSelection: () => set({ selectedPids: new Set() }),

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
    const details = await window.api.getProcessDetails(pid)
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
    await window.api.openInTerminal(pid, projectPath)
    get().addHistory({ action: 'open-terminal', pid })
  },

  openInVSCode: async (pid, projectPath) => {
    await window.api.openInVSCode(pid, projectPath)
    get().addHistory({ action: 'open-vscode', pid })
  },

  addTag: (port, tag) => {
    const { tags, ports, searchQuery, sortBy, sortDirection, profileFilter } = get()
    const portTags = [...(tags[port] || []), tag]
    const newTags = { ...tags, [port]: [...new Set(portTags)] }
    let filtered = filterPorts(ports, searchQuery, newTags)
    filtered = applyProfileFilter(filtered, profileFilter)
    set({
      tags: newTags,
      filteredPorts: sortPorts(filtered, sortBy, sortDirection)
    })
  },

  removeTag: (port, tag) => {
    const { tags, ports, searchQuery, sortBy, sortDirection, profileFilter } = get()
    const newTags = {
      ...tags,
      [port]: (tags[port] || []).filter((t) => t !== tag)
    }
    let filtered = filterPorts(ports, searchQuery, newTags)
    filtered = applyProfileFilter(filtered, profileFilter)
    set({
      tags: newTags,
      filteredPorts: sortPorts(filtered, sortBy, sortDirection)
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

  clearHistory: () => set({ history: [] })
}))
