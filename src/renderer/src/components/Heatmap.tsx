import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import { clsx } from 'clsx'

function getHeatColor(cpu: number, memory: number): string {
  const intensity = Math.max(cpu, memory * 1.5)
  if (intensity > 80) return 'bg-red-500/70 border-red-400/40'
  if (intensity > 60) return 'bg-orange-500/55 border-orange-400/35'
  if (intensity > 40) return 'bg-amber-500/45 border-amber-400/30'
  if (intensity > 20) return 'bg-sky-500/35 border-sky-400/25'
  return 'bg-emerald-500/30 border-emerald-400/20'
}

export function Heatmap() {
  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const selectedIndex = usePortStore((s) => s.selectedIndex)
  const selectPort = usePortStore((s) => s.selectPort)
  const openQuickPeek = useUIStore((s) => s.openQuickPeek)

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
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            No active ports to display
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {filteredPorts.map((port, index) => (
              <button
                key={`${port.pid}:${port.port}`}
                type="button"
                data-heatmap-cell={port.pid}
                tabIndex={selectedIndex === index ? 0 : -1}
                onClick={() => {
                  selectPort(port.pid)
                  openQuickPeek(port.pid)
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault()
                    selectPort(port.pid)
                    openQuickPeek(port.pid)
                  }
                }}
                className={clsx(
                  'relative p-2.5 rounded-lg border transition-all hover:scale-[1.02] hover:shadow-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                  getHeatColor(port.cpu, port.memory),
                  selectedIndex === index && 'ring-2 ring-accent/60'
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
