import { memo, useCallback, useMemo } from 'react'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { clsx } from 'clsx'
import type { PortInfo } from '../../../shared/types'

function getHeatColor(cpu: number, memory: number): string {
  const intensity = Math.max(cpu, memory * 1.5)
  if (intensity > 80) return 'bg-red-500/70 border-red-400/40'
  if (intensity > 60) return 'bg-orange-500/55 border-orange-400/35'
  if (intensity > 40) return 'bg-amber-500/45 border-amber-400/30'
  if (intensity > 20) return 'bg-sky-500/35 border-sky-400/25'
  return 'bg-emerald-500/30 border-emerald-400/20'
}

type HeatCellProps = {
  port: PortInfo
  index: number
  selected: boolean
  peekActive: boolean
  onActivate: (pid: number) => void
}

const HeatCell = memo(function HeatCell({
  port,
  index: _index,
  selected,
  peekActive,
  onActivate
}: HeatCellProps) {
  return (
    <button
      type="button"
      data-heatmap-cell={port.pid}
      tabIndex={selected ? 0 : -1}
      onClick={() => onActivate(port.pid)}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault()
          onActivate(port.pid)
        }
      }}
      className={clsx(
        'relative p-2.5 rounded-lg border transition-all hover:scale-[1.02] hover:shadow-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        getHeatColor(port.cpu, port.memory),
        peekActive && 'ring-2 ring-accent/60'
      )}
    >
      <div className="rounded-md bg-zinc-950/70 dark:bg-black/60 px-2 py-2 border border-white/10 shadow-inner backdrop-blur-[2px]">
        <p className="text-sm font-mono font-bold text-white drop-shadow-sm">
          :{port.port}
        </p>
        <p className="text-[10px] text-zinc-100/90 truncate mt-1 leading-tight">
          {port.projectName || port.command}
        </p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-200/85 tabular-nums">
          <span>{port.cpu.toFixed(0)}% cpu</span>
          <span>{port.memory.toFixed(0)}% mem</span>
        </div>
      </div>
    </button>
  )
})

export function Heatmap() {
  const ports = usePortStore((s) => s.ports)
  const searchQuery = usePortStore((s) => s.searchQuery)
  const portView = usePortStore((s) => s.portView)
  const filteredRaw = usePortStore((s) => s.filteredPorts)
  const profileFilter = usePortStore((s) => s.profileFilter)
  const hideSystemProcesses = useSettingsStore((s) => s.hideSystemProcesses)
  const filteredPorts = useMemo(() => {
    if (portView !== 'connections') {
      return filteredRaw.filter((p) => p.role !== 'connection')
    }
    let list = ports.filter((p) => p.role !== 'connection')
    if (hideSystemProcesses) list = list.filter((p) => !p.isSystem)
    if (profileFilter.length > 0) {
      list = list.filter((p) => profileFilter.includes(p.port))
    }
    return list
  }, [portView, filteredRaw, ports, hideSystemProcesses, profileFilter])
  const selectedIndex = usePortStore((s) => s.selectedIndex)
  const isQuickPeekOpen = useUIStore((s) => s.isQuickPeekOpen)
  const quickPeekPid = useUIStore((s) => s.quickPeekPid)

  const onActivate = useCallback((pid: number) => {
    usePortStore.getState().selectPort(pid)
    useUIStore.getState().openQuickPeek(pid)
  }, [])

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-text-primary">Resource Heatmap</h2>
        <p className="text-xs text-text-muted mt-1">
          Visual overview of port resource usage. Click any cell for details.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Low</span>
          <div className="flex gap-0.5">
            <div className="w-6 h-3 rounded bg-emerald-500/20" />
            <div className="w-6 h-3 rounded bg-blue-500/30" />
            <div className="w-6 h-3 rounded bg-yellow-500/40" />
            <div className="w-6 h-3 rounded bg-orange-500/60" />
            <div className="w-6 h-3 rounded bg-red-500/80" />
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredPorts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <p className="text-sm text-text-muted">
              {ports.length === 0
                ? 'No active ports to display'
                : 'No ports match your filters'}
            </p>
            <p className="text-xs text-text-muted max-w-sm">
              {ports.length === 0
                ? 'Listening processes will appear here once a server starts.'
                : searchQuery.trim()
                  ? `Nothing matches “${searchQuery.trim()}”. Clear search or adjust the active profile.`
                  : 'Clear search or switch / clear the active profile to see all ports.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {filteredPorts.map((port, index) => (
              <HeatCell
                key={`${port.pid}:${port.port}`}
                port={port}
                index={index}
                selected={selectedIndex === index}
                peekActive={isQuickPeekOpen && quickPeekPid === port.pid}
                onActivate={onActivate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
