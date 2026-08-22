import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  Search,
  Trash2,
  Globe,
  Terminal,
  Code2,
  LayoutDashboard,
  Grid3x3,
  Hash,
  Settings,
  Cpu,
  Skull,
  Braces,
  FileDiff,
  Columns2,
  ArrowLeftRight,
  Table2,
  UserPlus,
  Clipboard,
  ClipboardCopy,
  Database,
  Clock,
  Pause,
  Play,
  Binary,
  KeyRound,
  Link2,
  Regex,
  Copy,
  type LucideIcon
} from 'lucide-react'
import { clsx } from 'clsx'
import Fuse from 'fuse.js'
import type {
  ClipboardItem,
  ModuleId,
  NavLocation,
  PortInfo,
  TextToolId
} from '../../../shared/types'
import { MODULE_REGISTRY } from '../../../shared/modules/registry'
import { nextFreePort } from '../../../shared/next-free-port'
import { detectSmartPaste } from '../../../shared/smart-paste'
import { looksLikeTimeQuery } from '../../../shared/time-convert'
import { useHandoffStore } from '../stores/handoffStore'
import { paletteCalcHits } from '../lib/paletteCalc'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: LucideIcon
  category: 'recent' | 'ports' | 'clipboard' | 'navigation' | 'natural'
  handler: () => void
  shortcut?: string
  keywords?: string
}

const RECENT_COMMANDS_KEY = 'portpilot-cmd-recent-commands'
const MAX_RECENT = 8

type RecentCommand = { id: string; label: string; at: number }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

function pushRecentCommand(item: Pick<CommandItem, 'id' | 'label'>): RecentCommand[] {
  if (item.id.startsWith('recent-')) return readJson<RecentCommand[]>(RECENT_COMMANDS_KEY, [])
  const prev = readJson<RecentCommand[]>(RECENT_COMMANDS_KEY, [])
  const next = [
    { id: item.id, label: item.label, at: Date.now() },
    ...prev.filter((x) => x.id !== item.id)
  ].slice(0, MAX_RECENT)
  writeJson(RECENT_COMMANDS_KEY, next)
  return next
}

const MODULE_ICONS: Record<ModuleId, LucideIcon> = {
  ports: LayoutDashboard,
  text: Hash,
  database: Database,
  settings: Settings
}

const SCREEN_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  heatmap: Grid3x3,
  landing: Hash,
  'json-formatter': Braces,
  'json-diff': FileDiff,
  'js-console': Terminal,
  'text-diff': Columns2,
  'format-converter': ArrowLeftRight,
  'encode-decode': Binary,
  'jwt-inspector': KeyRound,
  'url-curl': Link2,
  regex: Regex,
  time: Clock,
  clipboard: Clipboard,
  connections: Database,
  tables: Table2,
  sql: Code2,
  'query-history': Clock,
  general: Settings,
  appearance: Settings,
  shortcuts: Hash,
  notifications: Hash,
  safety: Skull,
  profiles: UserPlus
}

function navFor(moduleId: ModuleId, screenId: string): NavLocation | null {
  switch (moduleId) {
    case 'ports':
      if (screenId === 'dashboard' || screenId === 'heatmap') {
        return { module: 'ports', screen: screenId }
      }
      return null
    case 'text':
      return {
        module: 'text',
        screen: screenId as 'landing' | TextToolId
      }
    case 'database':
      if (
        screenId === 'connections' ||
        screenId === 'tables' ||
        screenId === 'sql' ||
        screenId === 'query-history'
      ) {
        return {
          module: 'database',
          screen: screenId,
          connectionId: useUIStore.getState().lastDatabaseNav?.connectionId
        }
      }
      return null
    case 'settings':
      if (
        screenId === 'general' ||
        screenId === 'appearance' ||
        screenId === 'shortcuts' ||
        screenId === 'safety'
      ) {
        return { module: 'settings', screen: screenId }
      }
      if (screenId === 'notifications' || screenId === 'profiles') {
        return { module: 'settings', screen: 'general' }
      }
      return null
  }
}

export function CommandPalette() {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommands, setRecentCommands] = useState<RecentCommand[]>(() =>
    readJson(RECENT_COMMANDS_KEY, [])
  )
  const [clips, setClips] = useState<ClipboardItem[]>([])
  const [captureOn, setCaptureOn] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const allPorts = usePortStore((s) => s.ports)
  const killPort = usePortStore((s) => s.killPort)
  const openInBrowser = usePortStore((s) => s.openInBrowser)
  const openInTerminal = usePortStore((s) => s.openInTerminal)
  const openInVSCode = usePortStore((s) => s.openInVSCode)
  const closeCommandPalette = useUIStore((s) => s.closeCommandPalette)
  const openModule = useUIStore((s) => s.openModule)
  const setNav = useUIStore((s) => s.setNav)
  const addToast = useUIStore((s) => s.addToast)
  const showConfirm = useUIStore((s) => s.showConfirm)
  const confirmDestructive = useSettingsStore((s) => s.confirmDestructive)
  const protectSystemPorts = useSettingsStore((s) => s.protectSystemPorts)

  useEffect(() => {
    void window.api.clipboardGetHistory().then(setClips)
    void window.api.clipboardIsCaptureEnabled().then(setCaptureOn)
    return window.api.onClipboardUpdate(setClips)
  }, [])

  const runCommand = useCallback((item: CommandItem) => {
    if (item.category !== 'recent') {
      setRecentCommands(pushRecentCommand(item))
    }
    item.handler()
  }, [])

  const runKill = useCallback(
    (port: PortInfo) => {
      if (protectSystemPorts && port.isCritical) {
        addToast({
          type: 'warning',
          title: 'Protected Port',
          message: `Port ${port.port} is protected.`
        })
        closeCommandPalette()
        return
      }
      const doKill = async () => {
        const success = await killPort(port.pid)
        addToast({
          type: success ? 'success' : 'error',
          title: success ? 'Process Killed' : 'Failed',
          message: `Port ${port.port}`
        })
        closeCommandPalette()
      }
      if (confirmDestructive) {
        closeCommandPalette()
        showConfirm({
          title: 'Kill Process',
          message: `Kill port ${port.port} (${port.command})?`,
          confirmLabel: 'Kill',
          onConfirm: doKill
        })
      } else {
        void doKill()
      }
    },
    [
      protectSystemPorts,
      confirmDestructive,
      killPort,
      addToast,
      closeCommandPalette,
      showConfirm
    ]
  )

  const commands = useMemo<CommandItem[]>(() => {
    const nlpItems: CommandItem[] = []
    const portNums = [
      ...new Set(
        [...query.matchAll(/\b(\d{2,5})\b/g)]
          .map((m) => parseInt(m[1], 10))
          .filter((n) => n >= 8 && n <= 65535)
      )
    ]
    const ql = query.toLowerCase()
    const killIntent = /kill|stop|terminate|end/.test(ql)
    const statsIntent = /cpu|usage|mem|memory|load|stats|info|show/.test(ql)

    for (const num of portNums) {
      const p = allPorts.find(
        (ap) => ap.port === num && ap.role !== 'connection'
      )
      if (!p) continue
      const showKill = killIntent || (!killIntent && !statsIntent)
      const showStats = statsIntent || (!killIntent && !statsIntent)
      if (showKill) {
        nlpItems.push({
          id: `nlp-kill-${num}`,
          label: `Kill port ${num}`,
          description: `${p.command} (PID ${p.pid})`,
          icon: Skull,
          category: 'natural',
          handler: () => runKill(p)
        })
      }
      if (showStats) {
        nlpItems.push({
          id: `nlp-cpu-${num}`,
          label: `CPU & memory — port ${num}`,
          description: `${p.cpu.toFixed(1)}% CPU · ${p.memory.toFixed(1)}% MEM · ${p.command}`,
          icon: Cpu,
          category: 'natural',
          handler: () => {
            addToast({
              type: 'info',
              title: `Port ${num}`,
              message: `CPU ${p.cpu.toFixed(1)}%, memory ${p.memory.toFixed(1)}%, PID ${p.pid}`
            })
            closeCommandPalette()
          }
        })
      }
    }

    const smart = detectSmartPaste(query)
    for (const h of smart) {
      nlpItems.push({
        id: `smart-${h.tool}`,
        label: h.label,
        description: h.reason,
        icon: SCREEN_ICONS[h.tool] ?? Hash,
        category: 'natural',
        keywords: `${h.reason} ${h.tool} paste`,
        handler: () => {
          useHandoffStore.getState().navigateWithPayload(
            { module: 'text', screen: h.tool },
            query.trim()
          )
          closeCommandPalette()
        }
      })
    }

    const waitM = ql.match(/\bwait(?:\s+(?:for|on|until))?\s*:?\s*(\d{2,5})\b/)
    if (waitM) {
      const n = parseInt(waitM[1], 10)
      nlpItems.push({
        id: `nlp-wait-${n}`,
        label: `Wait for :${n}`,
        description: 'Toast when that port starts listening',
        icon: Clock,
        category: 'natural',
        keywords: `wait port ${n}`,
        handler: () => {
          usePortStore.getState().waitPort(n)
          closeCommandPalette()
        }
      })
    }

    if (/\b(next\s+free|free(\s+port)?)\b/.test(ql)) {
      const after = ql.match(
        /\b(?:after|from|at)\s*:?\s*(\d{2,5})\b|\b(\d{2,5})\b/
      )
      const from = after
        ? parseInt(after[1] || after[2] || '3000', 10)
        : 3000
      const used = allPorts
        .filter((p) => p.role !== 'connection')
        .map((p) => p.port)
      const next = nextFreePort(used, from)
      if (next != null) {
        nlpItems.push({
          id: `nlp-free-${from}`,
          label: `Next free port: ${next}`,
          description: `First unused listener at or after ${from}`,
          icon: Hash,
          category: 'natural',
          keywords: `next free port after ${from}`,
          handler: () => {
            void (async () => {
              await window.api.clipboardWrite(String(next))
              addToast({ type: 'success', title: `Copied :${next}` })
              closeCommandPalette()
            })()
          }
        })
      }
    }

    const calcHits = paletteCalcHits(query)
    for (const hit of calcHits) {
      nlpItems.push({
        id: `calc-${hit.id}`,
        label: hit.label,
        description: hit.description,
        icon: Copy,
        category: 'natural',
        keywords: `${hit.label} ${hit.value} copy now time epoch uuid base64`,
        handler: () => {
          void (async () => {
            await window.api.clipboardWrite(hit.value)
            addToast({ type: 'success', title: 'Copied', message: hit.value })
            closeCommandPalette()
          })()
        }
      })
    }
    if (looksLikeTimeQuery(query) || calcHits.some((h) => h.id.startsWith('time-'))) {
      const q = query.trim()
      const payload = /^(time|epoch|timezone|tz)$/i.test(q) ? '' : q
      nlpItems.push({
        id: 'open-time-bench',
        label: 'Open Time bench',
        description: 'UTC · IST · local · epoch · ISO',
        icon: Clock,
        category: 'natural',
        keywords: 'time timezone epoch ist utc now iso convert',
        handler: () => {
          useHandoffStore.getState().navigateWithPayload(
            { module: 'text', screen: 'time' },
            payload
          )
          closeCommandPalette()
        }
      })
    }

    const items: CommandItem[] = []

    for (const mod of MODULE_REGISTRY) {
      items.push({
        id: `nav-${mod.id}`,
        label: `Go to ${mod.label}`,
        description: mod.description,
        icon: MODULE_ICONS[mod.id],
        category: 'navigation',
        shortcut: mod.shortcut,
        keywords: `${mod.label} ${mod.description}`,
        handler: () => {
          openModule(mod.id)
          closeCommandPalette()
        }
      })

      for (const screen of mod.screens) {
        // Module root already covers "landing / all tools"
        if (screen.id === 'landing' || screen.id === 'dashboard') continue
        const nav = navFor(mod.id, screen.id)
        if (!nav) continue
        items.push({
          id: `nav-${mod.id}-${screen.id}`,
          label: `${mod.label} · ${screen.label}`,
          description: screen.description,
          icon: SCREEN_ICONS[screen.id] ?? MODULE_ICONS[mod.id],
          category: 'navigation',
          keywords: `${mod.label} ${screen.label} ${screen.description ?? ''} ${screen.id}`,
          handler: () => {
            setNav(nav)
            closeCommandPalette()
          }
        })
      }
    }

    const actionPorts = filteredPorts.filter((p) => p.role !== 'connection')
    for (const port of actionPorts) {
      const key = `${port.port}-${port.pid}`
      items.push(
        {
          id: `port-${key}`,
          label: `Port ${port.port}`,
          description: `${port.command} (PID ${port.pid}) — ${port.cpu.toFixed(1)}% CPU`,
          icon: Hash,
          category: 'ports',
          keywords: `port ${port.port} ${port.command} kill open`,
          handler: () => {
            setNav({ module: 'ports', screen: 'dashboard' })
            closeCommandPalette()
          }
        },
        {
          id: `kill-${key}`,
          label: `Kill :${port.port}`,
          description: `${port.command} (PID ${port.pid})`,
          icon: Trash2,
          category: 'ports',
          keywords: `kill stop terminate port ${port.port}`,
          handler: () => runKill(port)
        },
        {
          id: `open-${key}`,
          label: `Open :${port.port} in browser`,
          description: `http://localhost:${port.port}`,
          icon: Globe,
          category: 'ports',
          keywords: `browser open localhost port ${port.port}`,
          handler: () => {
            openInBrowser(port.port)
            closeCommandPalette()
          }
        },
        {
          id: `terminal-${key}`,
          label: `Open terminal for :${port.port}`,
          description: port.command,
          icon: Terminal,
          category: 'ports',
          keywords: `terminal shell cwd port ${port.port}`,
          handler: () => {
            openInTerminal(port.pid, port.projectPath)
            closeCommandPalette()
          }
        },
        {
          id: `vscode-${key}`,
          label: `Open VS Code for :${port.port}`,
          description: port.command,
          icon: Code2,
          category: 'ports',
          keywords: `vscode editor code port ${port.port}`,
          handler: () => {
            openInVSCode(port.pid, port.projectPath)
            closeCommandPalette()
          }
        }
      )
    }

    items.push(
      {
        id: 'clip-open',
        label: 'Open Clipboard',
        description: 'Clipboard history under Text & Data',
        icon: Clipboard,
        category: 'clipboard',
        keywords: 'clipboard history paste clips',
        handler: () => {
          setNav({ module: 'text', screen: 'clipboard' })
          closeCommandPalette()
        }
      },
      {
        id: 'clip-toggle-capture',
        label: captureOn ? 'Pause clipboard capture' : 'Start clipboard capture',
        description: captureOn
          ? 'Stop recording new copies'
          : 'Record copied text into history',
        icon: captureOn ? Pause : Play,
        category: 'clipboard',
        keywords: 'clipboard capture toggle pause start watch',
        handler: () => {
          void (async () => {
            const enabled = await window.api.clipboardSetCapture(!captureOn)
            setCaptureOn(enabled)
            addToast({
              type: 'info',
              title: enabled ? 'Capture on' : 'Capture paused'
            })
            closeCommandPalette()
          })()
        }
      },
      {
        id: 'clip-clear',
        label: 'Clear clipboard history',
        description: 'Remove unpinned clips',
        icon: Trash2,
        category: 'clipboard',
        keywords: 'clipboard clear delete history',
        handler: () => {
          void (async () => {
            setClips(await window.api.clipboardClear(true))
            addToast({
              type: 'success',
              title: 'Cleared',
              message: 'Unpinned clips removed'
            })
            closeCommandPalette()
          })()
        }
      }
    )

    for (const clip of clips.slice(0, 12)) {
      const preview =
        clip.text.length > 72 ? `${clip.text.slice(0, 72)}…` : clip.text
      items.push({
        id: `clip-copy-${clip.id}`,
        label: `Copy · ${preview}`,
        description: `${clip.kind}${clip.pinned ? ' · pinned' : ''}`,
        icon: ClipboardCopy,
        category: 'clipboard',
        keywords: `clipboard copy paste ${clip.kind} ${clip.text.slice(0, 80)}`,
        handler: () => {
          void (async () => {
            await window.api.clipboardWrite(clip.text)
            addToast({ type: 'success', title: 'Copied' })
            closeCommandPalette()
          })()
        }
      })
    }

    return [...nlpItems, ...items]
  }, [
    query,
    allPorts,
    filteredPorts,
    clips,
    captureOn,
    runKill,
    openInBrowser,
    openInTerminal,
    openInVSCode,
    closeCommandPalette,
    openModule,
    setNav,
    addToast
  ])

  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: [
          { name: 'label', weight: 0.5 },
          { name: 'description', weight: 0.25 },
          { name: 'keywords', weight: 0.25 }
        ],
        threshold: 0.4,
        includeScore: true
      }),
    [commands]
  )

  const filtered = useMemo(() => {
    if (!query.trim()) {
      const byId = new Map(commands.map((c) => [c.id, c]))
      const recentItems: CommandItem[] = []
      const seen = new Set<string>()

      for (const rc of recentCommands) {
        const live = byId.get(rc.id)
        if (!live || seen.has(live.id)) continue
        seen.add(live.id)
        recentItems.push({
          ...live,
          id: `recent-cmd-${live.id}`,
          category: 'recent',
          description: live.description ?? 'Recent',
          handler: () => {
            setRecentCommands(pushRecentCommand(live))
            live.handler()
          }
        })
      }

      const restNav = commands
        .filter((c) => c.category === 'navigation' && !seen.has(c.id))
        .slice(0, 10)
      const restPorts = commands
        .filter((c) => c.category === 'ports' && !seen.has(c.id))
        .slice(0, 6)
      const restClips = commands
        .filter((c) => c.category === 'clipboard' && !seen.has(c.id))
        .slice(0, 8)

      return [...recentItems, ...restNav, ...restPorts, ...restClips].slice(
        0,
        32
      )
    }

    const smartHits = commands.filter((c) => c.category === 'natural')
    const rest = fuse.search(query).slice(0, 28).map((r) => r.item)
    const seen = new Set(smartHits.map((c) => c.id))
    return [...smartHits, ...rest.filter((c) => !seen.has(c.id))].slice(0, 32)
  }, [fuse, commands, query, recentCommands])

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
          if (filtered[selectedIndex]) {
            runCommand(filtered[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          closeCommandPalette()
          break
      }
    },
    [filtered, selectedIndex, closeCommandPalette, runCommand]
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
    const order = ['recent', 'natural', 'navigation', 'ports', 'clipboard']
    const groups: Record<string, CommandItem[]> = {}
    const seen = new Set<string>()
    for (const item of filtered) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      if (!groups[item.category]) groups[item.category] = []
      groups[item.category].push(item)
    }
    return order
      .filter((k) => groups[k]?.length)
      .map((k) => [k, groups[k]] as const)
  }, [filtered])

  const categoryLabels: Record<string, string> = {
    recent: 'Recent',
    natural: 'Quick actions',
    navigation: 'Navigation',
    ports: 'Ports',
    clipboard: 'Clipboard'
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
            placeholder="Try now, now ist, epoch, uuid…"
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
            grouped.map(([category, items]) => (
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
                      onClick={() => runCommand(item)}
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
