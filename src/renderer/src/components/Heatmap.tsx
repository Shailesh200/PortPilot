import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import { clsx } from 'clsx'

function getHeatColor(cpu: number, memory: number): string {
  const intensity = Math.max(cpu, memory * 1.5)
  if (intensity > 80) return 'bg-red-500/80 border-red-500/50'
  if (intensity > 60) return 'bg-orange-500/60 border-orange-500/40'
  if (intensity > 40) return 'bg-yellow-500/40 border-yellow-500/30'
  if (intensity > 20) return 'bg-blue-500/30 border-blue-500/20'
  return 'bg-emerald-500/20 border-emerald-500/15'
}

export function Heatmap() {
  const filteredPorts = usePortStore((s) => s.filteredPorts)
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
            {filteredPorts.map((port) => (
              <button
                key={`${port.pid}:${port.port}`}
                onClick={() => {
                  selectPort(port.pid)
                  openQuickPeek(port.pid)
                }}
                className={clsx(
                  'relative p-3 rounded-lg border transition-all hover:scale-[1.03] hover:shadow-lg text-left',
                  getHeatColor(port.cpu, port.memory)
                )}
              >
                <p className="text-sm font-mono font-bold text-text-primary">
                  :{port.port}
                </p>
                <p className="text-[10px] text-text-secondary truncate mt-0.5">
                  {port.projectName || port.command}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-text-muted">
                  <span>{port.cpu.toFixed(0)}% cpu</span>
                  <span>{port.memory.toFixed(0)}% mem</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
