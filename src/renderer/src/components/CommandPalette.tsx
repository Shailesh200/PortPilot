import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import {
  Search,
  Trash2,
  Globe,
  Terminal,
  Code2,
  LayoutDashboard,
  Grid3x3,
  ScrollText,
  Hash,
  Settings
} from 'lucide-react'
import { clsx } from 'clsx'
import Fuse from 'fuse.js'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: typeof Search
  category: 'port' | 'action' | 'navigation'
  handler: () => void
  shortcut?: string
}

export function CommandPalette() {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const killPort = usePortStore((s) => s.killPort)
  const openInBrowser = usePortStore((s) => s.openInBrowser)
  const openInTerminal = usePortStore((s) => s.openInTerminal)
  const openInVSCode = usePortStore((s) => s.openInVSCode)
  const closeCommandPalette = useUIStore((s) => s.closeCommandPalette)
  const setView = useUIStore((s) => s.setView)
  const addToast = useUIStore((s) => s.addToast)

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        icon: LayoutDashboard,
        category: 'navigation',
        handler: () => {
          setView('dashboard')
          closeCommandPalette()
        },
        shortcut: '⌘1'
      },
      {
        id: 'nav-heatmap',
        label: 'Go to Heatmap',
        icon: Grid3x3,
        category: 'navigation',
        handler: () => {
          setView('heatmap')
          closeCommandPalette()
        },
        shortcut: '⌘2'
      },
      {
        id: 'nav-logs',
        label: 'Go to Logs',
        icon: ScrollText,
        category: 'navigation',
        handler: () => {
          setView('logs')
          closeCommandPalette()
        },
        shortcut: '⌘3'
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        icon: Settings,
        category: 'navigation',
        handler: () => {
          setView('settings')
          closeCommandPalette()
        },
        shortcut: '⌘,'
      }
    ]

    for (const port of filteredPorts) {
      items.push(
        {
          id: `port-${port.port}-${port.pid}`,
          label: `Port ${port.port}`,
          description: `${port.command} (PID ${port.pid}) — ${port.cpu.toFixed(1)}% CPU`,
          icon: Hash,
          category: 'port',
          handler: () => closeCommandPalette()
        },
        {
          id: `kill-${port.pid}`,
          label: `Kill :${port.port}`,
          description: `${port.command} (PID ${port.pid})`,
          icon: Trash2,
          category: 'action',
          handler: async () => {
            const success = await killPort(port.pid)
            addToast({
              type: success ? 'success' : 'error',
              title: success ? 'Process Killed' : 'Failed',
              message: `Port ${port.port}`
            })
            closeCommandPalette()
          }
        },
        {
          id: `open-${port.port}-${port.pid}`,
          label: `Open :${port.port} in browser`,
          description: `http://localhost:${port.port}`,
          icon: Globe,
          category: 'action',
          handler: () => {
            openInBrowser(port.port)
            closeCommandPalette()
          }
        },
        {
          id: `terminal-${port.pid}`,
          label: `Open terminal for :${port.port}`,
          description: port.command,
          icon: Terminal,
          category: 'action',
          handler: () => {
            openInTerminal(port.pid)
            closeCommandPalette()
          }
        },
        {
          id: `vscode-${port.pid}`,
          label: `Open VS Code for :${port.port}`,
          description: port.command,
          icon: Code2,
          category: 'action',
          handler: () => {
            openInVSCode(port.pid)
            closeCommandPalette()
          }
        }
      )
    }

    return items
  }, [
    filteredPorts,
    killPort,
    openInBrowser,
    openInTerminal,
    openInVSCode,
    closeCommandPalette,
    setView,
    addToast
  ])

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['label', 'description'],
        threshold: 0.4,
        includeScore: true
      }),
    [commands]
  )

  const filtered = useMemo(() => {
    if (!query) return commands.slice(0, 20)
    return fuse.search(query).slice(0, 20).map((r) => r.item)
  }, [fuse, commands, query])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[selectedIndex]) filtered[selectedIndex].handler()
          break
        case 'Escape':
          e.preventDefault()
          closeCommandPalette()
          break
      }
    },
    [filtered, selectedIndex, closeCommandPalette]
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return groups
  }, [filtered])

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    port: 'Ports',
    action: 'Actions'
  }

  let flatIndex = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={closeCommandPalette}
    >
      <div
        data-skip-port-shortcuts
        className="w-full max-w-[560px] bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border-subtle">
          <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <span className="kbd">Esc</span>
        </div>

        <div ref={listRef} className="max-h-[340px] overflow-auto py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-muted">
              No results found
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
                    {categoryLabels[category] || category}
                  </span>
                </div>
                {items.map((item) => {
                  flatIndex++
                  const idx = flatIndex
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                        idx === selectedIndex
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-secondary hover:bg-bg-hover'
                      )}
                      onClick={() => item.handler()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.label}</p>
                        {item.description && (
                          <p className="text-xs text-text-muted truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.shortcut && (
                        <span className="kbd text-[9px]">{item.shortcut}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border-subtle text-[10px] text-text-muted">
          <span>
            <span className="kbd">↑↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> select
          </span>
          <span>
            <span className="kbd">esc</span> close
          </span>
        </div>
      </div>
    </div>
  )
}
