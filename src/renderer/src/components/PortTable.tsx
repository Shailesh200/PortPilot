import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  ArrowUpDown,
  Trash2,
  Globe,
  Terminal,
  Code2,
  ChevronRight,
  AlertTriangle,
  Shield,
  FolderOpen,
  MoreVertical,
  RotateCw,
  Copy,
  Eye,
  Check,
  Minus,
  X,
  Star,
  UserPlus
} from 'lucide-react'
import { clsx } from 'clsx'
import type { PortInfo } from '../../../shared/types'

function formatMemory(rss: number): string {
  if (rss < 1024) return `${rss} KB`
  if (rss < 1024 * 1024) return `${(rss / 1024).toFixed(1)} MB`
  return `${(rss / 1024 / 1024).toFixed(1)} GB`
}

function Checkbox({
  checked,
  indeterminate,
  onChange
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={clsx(
        'w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0',
        checked || indeterminate
          ? 'bg-accent border-accent text-white'
          : 'border-border-strong hover:border-accent/50 text-transparent'
      )}
    >
      {indeterminate ? (
        <Minus className="w-2.5 h-2.5" strokeWidth={3} />
      ) : checked ? (
        <Check className="w-2.5 h-2.5" strokeWidth={3} />
      ) : null}
    </button>
  )
}

function CpuBar({ value }: { value: number }) {
  const color =
    value > 80
      ? 'bg-danger'
      : value > 50
        ? 'bg-warning'
        : value > 20
          ? 'bg-accent'
          : 'bg-success'

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-text-secondary w-12 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  )
}

function ActionMenu({
  port,
  onClose
}: {
  port: PortInfo
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const killPort = usePortStore((s) => s.killPort)
  const restartPort = usePortStore((s) => s.restartPort)
  const openInBrowser = usePortStore((s) => s.openInBrowser)
  const openInTerminal = usePortStore((s) => s.openInTerminal)
  const openInVSCode = usePortStore((s) => s.openInVSCode)
  const openQuickPeek = useUIStore((s) => s.openQuickPeek)
  const addToast = useUIStore((s) => s.addToast)
  const confirmDestructive = useSettingsStore((s) => s.confirmDestructive)
  const protectSystemPorts = useSettingsStore((s) => s.protectSystemPorts)
  const showConfirm = useUIStore((s) => s.showConfirm)
  const profiles = useSettingsStore((s) => s.profiles)
  const addPortToProfile = useSettingsStore((s) => s.addPortToProfile)
  const reapplyFiltersAndSort = usePortStore((s) => s.reapplyFiltersAndSort)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const actions = [
    {
      id: 'preview',
      label: 'Quick Preview',
      icon: Eye,
      shortcut: 'Space',
      className: 'hover:bg-bg-hover text-text-secondary hover:text-text-primary',
      handler: () => {
        openQuickPeek(port.pid)
        onClose()
      }
    },
    {
      id: 'browser',
      label: 'Open in Browser',
      icon: Globe,
      shortcut: 'O',
      className: 'hover:bg-info/10 text-text-secondary hover:text-info',
      handler: () => {
        openInBrowser(port.port)
        onClose()
      }
    },
    {
      id: 'terminal',
      label: 'Open Terminal',
      icon: Terminal,
      shortcut: 'T',
      className: 'hover:bg-success/10 text-text-secondary hover:text-success',
      handler: () => {
        openInTerminal(port.pid, port.projectPath)
        onClose()
      }
    },
    {
      id: 'editor',
      label: 'Open in Editor',
      icon: Code2,
      shortcut: 'V',
      className: 'hover:bg-accent/10 text-text-secondary hover:text-accent',
      handler: () => {
        openInVSCode(port.pid, port.projectPath)
        onClose()
      }
    },
    {
      id: 'copy',
      label: 'Copy Address',
      icon: Copy,
      className: 'hover:bg-bg-hover text-text-secondary hover:text-text-primary',
      handler: () => {
        navigator.clipboard.writeText(`localhost:${port.port}`)
        addToast({ type: 'info', title: 'Copied', message: `localhost:${port.port}` })
        onClose()
      }
    },
    ...profiles.map((pr) => ({
      id: `add-prof-${pr.id}-${port.port}`,
      label: `Add :${port.port} to ${pr.name}`,
      icon: UserPlus,
      className: 'hover:bg-accent/10 text-text-secondary hover:text-accent',
      handler: () => {
        addPortToProfile(pr.id, port.port)
        reapplyFiltersAndSort()
        addToast({
          type: 'success',
          title: 'Profile updated',
          message: `Port ${port.port} added to ${pr.name}`
        })
        onClose()
      }
    })),
    { id: 'divider-1' },
    {
      id: 'restart',
      label: 'Restart Process',
      icon: RotateCw,
      shortcut: 'R',
      className: 'hover:bg-warning/10 text-text-secondary hover:text-warning',
      handler: async () => {
        onClose()
        const doRestart = async () => {
          addToast({ type: 'info', title: 'Restarting...', message: `Port ${port.port} (${port.command})` })
          const result = await restartPort(port.pid, port.projectPath)
          addToast({
            type: result.success ? 'success' : 'error',
            title: result.success ? 'Process restarted' : 'Restart Failed',
            message: result.success
              ? result.hint || `Port ${port.port} — command re-launched`
              : result.error || 'Unknown error'
          })
        }
        if (confirmDestructive) {
          showConfirm({
            title: 'Restart Process',
            message: `Are you sure you want to restart port ${port.port} (${port.command})?`,
            variant: 'warning',
            confirmLabel: 'Restart',
            onConfirm: doRestart
          })
        } else {
          await doRestart()
        }
      }
    },
    {
      id: 'kill',
      label: 'Kill Process',
      icon: Trash2,
      shortcut: 'K',
      className: 'hover:bg-danger/10 text-text-secondary hover:text-danger',
      handler: async () => {
        onClose()
        if (protectSystemPorts && port.isCritical) {
          addToast({
            type: 'warning',
            title: 'Protected Port',
            message: `Port ${port.port} is protected. Disable "Protect system ports" in Settings to kill it.`
          })
          return
        }
        const doKill = async () => {
          const success = await killPort(port.pid)
          addToast({
            type: success ? 'success' : 'error',
            title: success ? 'Process Killed' : 'Failed to Kill',
            message: `Port ${port.port} (${port.command}) PID ${port.pid}`
          })
        }
        if (confirmDestructive) {
          showConfirm({
            title: 'Kill Process',
            message: `Are you sure you want to kill port ${port.port} (${port.command}, PID ${port.pid})?`,
            variant: port.isCritical ? 'warning' : 'danger',
            confirmLabel: 'Kill',
            onConfirm: doKill
          })
        } else {
          await doKill()
        }
      }
    }
  ] as const

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 w-52 py-1.5 bg-bg-card rounded-lg border border-border shadow-xl shadow-black/20 animate-in fade-in slide-in-from-top-1 duration-100"
    >
      {actions.map((action) => {
        if ('label' in action) {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              onClick={action.handler}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors',
                action.className
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 text-left">{action.label}</span>
              {'shortcut' in action && action.shortcut && (
                <span className="text-[10px] text-text-muted font-mono opacity-60">
                  {action.shortcut}
                </span>
              )}
            </button>
          )
        }
        return (
          <div key={action.id} className="my-1 border-t border-border-subtle" />
        )
      })}
    </div>
  )
}

function PortRow({ port, index }: { port: PortInfo; index: number }) {
  const selectedPids = usePortStore((s) => s.selectedPids)
  const togglePortSelection = usePortStore((s) => s.togglePortSelection)
  const selectedIndex = usePortStore((s) => s.selectedIndex)
  const addTag = usePortStore((s) => s.addTag)
  const removeTag = usePortStore((s) => s.removeTag)
  const expandedRows = useUIStore((s) => s.expandedRows)
  const toggleRowExpansion = useUIStore((s) => s.toggleRowExpansion)
  const openQuickPeek = useUIStore((s) => s.openQuickPeek)
  const activeProfileId = useSettingsStore((s) => s.activeProfileId)
  const profiles = useSettingsStore((s) => s.profiles)

  const activeProfile = activeProfileId ? profiles.find((p) => p.id === activeProfileId) : null
  const isFavorite = activeProfile ? activeProfile.favoritePorts.includes(port.port) : false

  const [menuOpen, setMenuOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const isSelected = selectedPids.has(port.pid)
  const isHighlighted = selectedIndex === index
  const isExpanded = expandedRows.has(port.pid)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <>
      <tr
        data-port-row={port.pid}
        tabIndex={isHighlighted ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            openQuickPeek(port.pid)
          }
        }}
        className={clsx(
          'group transition-colors border-b border-border-subtle/50 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset',
          isHighlighted && 'bg-accent/5',
          isSelected && !isHighlighted && 'bg-accent/[0.03]',
          !isSelected && !isHighlighted && 'hover:bg-bg-hover/50'
        )}
      >
        <td className="py-2.5 px-3 w-10">
          <Checkbox
            checked={isSelected}
            onChange={() => togglePortSelection(port.pid)}
          />
        </td>
        <td className="py-2.5 px-3 w-8">
          <button
            onClick={() => toggleRowExpansion(port.pid)}
            className="p-0.5 rounded hover:bg-bg-elevated transition-colors"
          >
            <ChevronRight
              className={clsx(
                'w-3.5 h-3.5 text-text-muted transition-transform duration-150',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        </td>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2 max-w-[180px]">
            <FolderOpen className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
            <span
              className="text-sm text-text-primary truncate font-medium"
              title={port.projectPath || port.projectName || port.command}
            >
              {port.projectName || port.command}
            </span>
          </div>
        </td>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            {isFavorite && <Star className="w-3 h-3 text-warning fill-warning" />}
            {port.isCritical && <Shield className="w-3 h-3 text-warning" />}
            <span className="font-mono text-sm font-semibold text-text-primary">
              {port.port}
            </span>
          </div>
        </td>
        <td className="py-2.5 px-3">
          <span className="text-xs font-mono text-text-muted">{port.pid}</span>
        </td>
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-2">
            <div
              className={clsx(
                'w-1.5 h-1.5 rounded-full',
                port.cpu > 50 ? 'bg-warning animate-pulse-soft' : 'bg-success'
              )}
            />
            <span className="text-sm text-text-secondary truncate max-w-[160px]">
              {port.command}
            </span>
          </div>
        </td>
        <td className="py-2.5 px-3">
          <CpuBar value={port.cpu} />
        </td>
        <td className="py-2.5 px-3">
          <span className="text-xs text-text-secondary">
            {port.memory.toFixed(1)}%
          </span>
          <span className="text-xs text-text-muted ml-1">
            ({formatMemory(port.memoryRSS)})
          </span>
        </td>
        <td className="py-2.5 px-3">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
              className={clsx(
                'p-1.5 rounded-md transition-all',
                menuOpen
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted opacity-0 group-hover:opacity-100 hover:bg-bg-elevated hover:text-text-primary'
              )}
              title="Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && <ActionMenu port={port} onClose={closeMenu} />}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-bg-card/50">
          <td colSpan={10} className="py-3 px-6">
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-text-muted">Project Path</span>
                <p className="text-text-secondary font-mono mt-0.5 truncate" title={port.projectPath}>
                  {port.projectPath || '—'}
                </p>
              </div>
              <div>
                <span className="text-text-muted">Address</span>
                <p className="text-text-secondary font-mono mt-0.5">
                  {port.address}:{port.port}
                </p>
                <p className="text-[10px] mt-0.5">
                  {port.address === '*' ||
                  port.address === '0.0.0.0' ||
                  port.address === '::' ? (
                    <span className="text-warning">Exposed externally</span>
                  ) : (
                    <span className="text-success">Localhost only</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-text-muted">Protocol / State</span>
                <p className="text-text-secondary font-mono mt-0.5">
                  {port.protocol} · {port.state}
                </p>
              </div>
              <div>
                <span className="text-text-muted">Tags</span>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {port.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-accent/10 text-accent text-[10px] rounded group"
                    >
                      {tag}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTag(port.port, tag)
                        }}
                        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault()
                        e.stopPropagation()
                        addTag(port.port, tagInput.trim())
                        setTagInput('')
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="+ Add tag"
                    className="w-20 bg-transparent border-b border-border-subtle text-[10px] text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-accent/50 py-0.5"
                  />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const sortableColumns: {
  key: keyof PortInfo
  label: string
}[] = [
  { key: 'projectName', label: 'Name' },
  { key: 'port', label: 'Port' },
  { key: 'pid', label: 'PID' },
  { key: 'command', label: 'Process' },
  { key: 'cpu', label: 'CPU' },
  { key: 'memory', label: 'Memory' }
]

export function PortTable() {
  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const sortBy = usePortStore((s) => s.sortBy)
  const sortDirection = usePortStore((s) => s.sortDirection)
  const setSortBy = usePortStore((s) => s.setSortBy)
  const selectedPids = usePortStore((s) => s.selectedPids)
  const killSelected = usePortStore((s) => s.killSelected)
  const selectAll = usePortStore((s) => s.selectAll)
  const clearSelection = usePortStore((s) => s.clearSelection)
  const confirmDestructive = useSettingsStore((s) => s.confirmDestructive)
  const showConfirm = useUIStore((s) => s.showConfirm)

  const [groupByProject, setGroupByProject] = useState(false)

  const groupedPorts = useMemo(() => {
    if (!groupByProject) return null
    const groups: Record<string, typeof filteredPorts> = {}
    for (const port of filteredPorts) {
      const key = port.projectName || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(port)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredPorts, groupByProject])

  const allSelected = filteredPorts.length > 0 && selectedPids.size === filteredPorts.length
  const someSelected = selectedPids.size > 0 && !allSelected

  const handleHeaderCheckbox = () => {
    if (allSelected || someSelected) {
      clearSelection()
    } else {
      selectAll()
    }
  }

  const handleBulkKill = () => {
    if (confirmDestructive) {
      showConfirm({
        title: 'Kill Selected Processes',
        message: `Are you sure you want to kill ${selectedPids.size} process${selectedPids.size > 1 ? 'es' : ''}?`,
        confirmLabel: 'Kill All',
        onConfirm: () => killSelected()
      })
    } else {
      killSelected()
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg-card rounded-xl border border-border-subtle overflow-hidden">
      {selectedPids.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-accent/5 border-b border-border-subtle animate-in fade-in duration-100">
          <span className="text-xs text-accent font-semibold">
            {selectedPids.size} selected
          </span>
          <div className="w-px h-4 bg-border-subtle" />
          <button
            onClick={handleBulkKill}
            className="text-xs px-2.5 py-1 rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            Kill
          </button>
          <button
            onClick={selectAll}
            className="text-xs px-2.5 py-1 rounded-md bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors"
          >
            Select All
          </button>
          <div className="flex-1" />
          <button
            onClick={clearSelection}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto" data-port-table>
        <table className="w-full">
          <thead className="sticky top-0 bg-bg-card z-10">
            <tr className="border-b border-border">
              <th className="w-10 py-3 px-3">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={handleHeaderCheckbox}
                />
              </th>
              <th className="w-8" />
              {sortableColumns.map(({ key, label }) => (
                <th
                  key={key}
                  className="text-left py-3 px-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold cursor-pointer hover:text-text-secondary transition-colors select-none"
                  onClick={() => setSortBy(key)}
                >
                  <div className="flex items-center gap-1.5">
                    {label}
                    {sortBy === key && (
                      <ArrowUpDown
                        className={clsx(
                          'w-3 h-3 text-accent',
                          sortDirection === 'desc' && 'rotate-180'
                        )}
                      />
                    )}
                  </div>
                </th>
              ))}
              <th className="text-left py-3 px-3 text-[11px] uppercase tracking-wider text-text-muted font-semibold w-12" />
            </tr>
          </thead>
          <tbody>
            {filteredPorts.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-text-muted" />
                    <p className="text-sm text-text-muted">
                      No listening ports found
                    </p>
                    <p className="text-xs text-text-muted">
                      Start a development server to see active ports
                    </p>
                  </div>
                </td>
              </tr>
            ) : groupedPorts ? (
              groupedPorts.map(([projectName, ports]) => {
                const startIdx = filteredPorts.indexOf(ports[0])
                return (
                  <React.Fragment key={projectName}>
                    <tr className="bg-bg-surface/50">
                      <td colSpan={10} className="px-4 py-1.5">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-3 h-3 text-accent" />
                          <span className="text-xs font-semibold text-text-primary">{projectName}</span>
                          <span className="text-[10px] text-text-muted">({ports.length})</span>
                        </div>
                      </td>
                    </tr>
                    {ports.map((port, i) => (
                      <PortRow
                        key={`${port.pid}:${port.port}`}
                        port={port}
                        index={startIdx + i}
                      />
                    ))}
                  </React.Fragment>
                )
              })
            ) : (
              filteredPorts.map((port, index) => (
                <PortRow
                  key={`${port.pid}:${port.port}`}
                  port={port}
                  index={index}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle text-[11px] text-text-muted">
        <div className="flex items-center gap-3">
          <span>{filteredPorts.length} ports</span>
          <button
            onClick={() => setGroupByProject((v) => !v)}
            className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors',
              groupByProject ? 'bg-accent/10 text-accent' : 'hover:bg-bg-hover hover:text-text-secondary'
            )}
          >
            <FolderOpen className="w-3 h-3" />
            Group
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span>
            <span className="kbd">↑↓</span> navigate
          </span>
          <span>
            <span className="kbd">Space</span> / <span className="kbd">↵</span> preview
          </span>
          <span>
            <span className="kbd">⋮</span> actions
          </span>
        </div>
      </div>
    </div>
  )
}
