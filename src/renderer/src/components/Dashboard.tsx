import { usePortStore } from '../stores/portStore'
import { useSettingsStore } from '../stores/settingsStore'
import { PortTable } from './PortTable'
import { Activity, Cpu, MemoryStick, Network, RefreshCw, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { useMemo } from 'react'
import { formatAgo, recentlyStopped } from '../lib/portOccupancy'

function StatsCard({
  icon: Icon,
  label,
  value,
  color,
  subtext
}: {
  icon: typeof Activity
  label: string
  value: string | number
  color: string
  subtext?: string
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-border-subtle p-4 hover:border-border transition-colors">
      <div className="flex items-center gap-3">
        <div className={clsx('p-2 rounded-lg', color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>
          <p className="text-xs text-text-muted">{label}</p>
        </div>
      </div>
      {subtext && <p className="text-[10px] text-text-muted mt-2">{subtext}</p>}
    </div>
  )
}

export function Dashboard() {
  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const searchQuery = usePortStore((s) => s.searchQuery)
  const setSearchQuery = usePortStore((s) => s.setSearchQuery)
  const fetchPorts = usePortStore((s) => s.fetchPorts)
  const isLoading = usePortStore((s) => s.isLoading)
  const cpuThreshold = useSettingsStore((s) => s.cpuThreshold)
  const memoryThreshold = useSettingsStore((s) => s.memoryThreshold)
  const waitPort = usePortStore((s) => s.waitPort)
  const waitingPort = usePortStore((s) => s.waitingPort)

  const uniqueProcesses = new Set(filteredPorts.map((p) => p.pid)).size
  const highCpu = filteredPorts.filter((p) => p.cpu > cpuThreshold).length
  const highMem = filteredPorts.filter((p) => p.memory > memoryThreshold).length
  const occupancy = usePortStore((s) => s.occupancy)
  const stopped = useMemo(() => recentlyStopped(occupancy), [occupancy])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 p-6 pb-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search ports, processes, PIDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-card border border-border-subtle rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            id="search-input"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="kbd">/</span>
          </div>
        </div>
        <button
          onClick={() => fetchPorts()}
          className={clsx(
            'p-2.5 bg-bg-card border border-border-subtle rounded-lg text-text-secondary hover:text-text-primary hover:border-border transition-all',
            isLoading && 'animate-spin'
          )}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 p-6">
        <StatsCard
          icon={Network}
          label="Active Ports"
          value={filteredPorts.length}
          color="bg-accent-muted text-accent"
        />
        <StatsCard
          icon={Activity}
          label="Processes"
          value={uniqueProcesses}
          color="bg-success-muted text-success"
          subtext="Unique PIDs listening"
        />
        <StatsCard
          icon={Cpu}
          label="High CPU"
          value={highCpu}
          color={
            highCpu > 0
              ? 'bg-warning-muted text-warning'
              : 'bg-success-muted text-success'
          }
          subtext={
            highCpu > 0
              ? `Processes using >${cpuThreshold}% CPU`
              : 'All normal'
          }
        />
        <StatsCard
          icon={MemoryStick}
          label="High Memory"
          value={highMem}
          color={
            highMem > 0
              ? 'bg-danger-muted text-danger'
              : 'bg-success-muted text-success'
          }
          subtext={
            highMem > 0
              ? `Processes using >${memoryThreshold}% memory`
              : 'All normal'
          }
        />
      </div>

      {stopped.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-6 pb-0 pt-3">
          <span className="text-[11px] uppercase tracking-wider text-text-muted">
            Recently stopped
          </span>
          {stopped.map((item) => (
            <span
              key={`${item.port}-${item.at}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary"
              title={`${item.command} left :${item.port}`}
            >
              <span className="font-mono text-text-primary">:{item.port}</span>
              <span className="truncate max-w-[8rem]">{item.command}</span>
              <span className="text-text-muted">{formatAgo(item.at)}</span>
              <button
                type="button"
                onClick={() =>
                  waitPort(waitingPort === item.port ? null : item.port)
                }
                className="text-accent hover:underline"
              >
                {waitingPort === item.port ? 'Cancel wait' : 'Wait'}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-hidden px-6 pb-6">
        <PortTable />
      </div>
    </div>
  )
}
