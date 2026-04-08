import { useState, useRef, useEffect, useMemo } from 'react'
import { usePortStore } from '../stores/portStore'
import { Clock, Filter, Terminal, RefreshCw, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

type Tab = 'activity' | 'process'

interface LogEntry {
  id: string
  timestamp: number
  type: 'info' | 'warn' | 'error' | 'success'
  message: string
}

const HIGHLIGHT_RE =
  /error|fatal|exception|warn|warning|failed|failure|panic|EADDR|ENOENT|Cannot find|undefined is not|Unhandled|Traceback|npm ERR|ELIFECYCLE|FATAL|✖|⨯/i

export function LogViewer() {
  const history = usePortStore((s) => s.history)
  const ports = usePortStore((s) => s.ports)
  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const [filter, setFilter] = useState<string>('all')
  const [tab, setTab] = useState<Tab>('activity')
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const [processLogs, setProcessLogs] = useState<string[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const portPickerList = ports.length > 0 ? ports : filteredPorts

  const fetchLogs = async (pid: number) => {
    setLogsLoading(true)
    try {
      const logs = await window.api.getProcessLogs(pid)
      setProcessLogs(logs)
    } catch {
      setProcessLogs(['Failed to fetch logs.'])
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'process' && selectedPid) {
      void fetchLogs(selectedPid)
      const interval = setInterval(() => void fetchLogs(selectedPid), 5000)
      return () => clearInterval(interval)
    }
  }, [tab, selectedPid])

  const highlights = useMemo(() => {
    return processLogs.filter(
      (l) => !l.startsWith('---') && HIGHLIGHT_RE.test(l)
    )
  }, [processLogs])

  const logs: LogEntry[] = history.map((h) => ({
    id: h.id,
    timestamp: h.timestamp,
    type:
      h.action === 'kill'
        ? 'warn'
        : h.action === 'restart'
          ? 'info'
          : 'info',
    message: `${h.action.toUpperCase()} — ${h.command || 'Unknown'} on port ${h.port || '?'} (PID ${h.pid || '?'})`
  }))

  const portLogs: LogEntry[] = filteredPorts.map((p) => ({
    id: `active-${p.pid}-${p.port}`,
    timestamp: Date.now(),
    type: p.cpu > 50 ? ('warn' as const) : ('success' as const),
    message: `ACTIVE — ${p.projectName || p.command} on port ${p.port} (CPU: ${p.cpu.toFixed(1)}%, MEM: ${p.memory.toFixed(1)}%)`
  }))

  const allLogs = [...logs, ...portLogs].sort((a, b) => b.timestamp - a.timestamp)
  const filtered =
    filter === 'all' ? allLogs : allLogs.filter((l) => l.type === filter)

  const typeColors = {
    info: 'text-info',
    warn: 'text-warning',
    error: 'text-danger',
    success: 'text-success'
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Activity Logs</h2>
          <p className="text-xs text-text-muted mt-1">
            Recent actions, port activity, file-based process logs, and error
            highlights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-bg-card rounded-lg border border-border-subtle p-0.5">
            <button
              onClick={() => setTab('activity')}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                tab === 'activity'
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Activity
            </button>
            <button
              onClick={() => setTab('process')}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                tab === 'process'
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              Process Logs
            </button>
          </div>
          {tab === 'activity' && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-text-muted" />
              {['all', 'info', 'warn', 'error', 'success'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'text-xs px-2 py-1 rounded-md transition-colors capitalize',
                    filter === f
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === 'process' && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {portPickerList.map((p) => (
            <button
              key={`${p.pid}-${p.port}`}
              type="button"
              onClick={() => setSelectedPid(p.pid)}
              className={clsx(
                'px-2.5 py-1 rounded-md text-xs font-mono transition-colors border',
                selectedPid === p.pid
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border-subtle bg-bg-card text-text-secondary hover:border-border hover:text-text-primary'
              )}
            >
              :{p.port} {p.projectName || p.command}
            </button>
          ))}
          {selectedPid && (
            <button
              type="button"
              onClick={() => void fetchLogs(selectedPid)}
              className={clsx(
                'p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors',
                logsLoading && 'animate-spin'
              )}
              title="Refresh logs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-bg-card rounded-xl border border-border-subtle"
      >
        {tab === 'activity' ? (
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
              <Clock className="w-8 h-8 mb-2" />
              <p>No activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle/50">
              {filtered.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-bg-hover/30 transition-colors"
                >
                  <div
                    className={clsx(
                      'mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0',
                      {
                        'bg-info': log.type === 'info',
                        'bg-warning': log.type === 'warn',
                        'bg-danger': log.type === 'error',
                        'bg-success': log.type === 'success'
                      }
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={clsx(
                        'text-xs font-mono',
                        typeColors[log.type]
                      )}
                    >
                      {log.message}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted tabular-nums flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : !selectedPid ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
            <Terminal className="w-8 h-8 mb-2" />
            <p>Select a process to view file & project log output</p>
            <p className="text-[11px] mt-2 max-w-md text-center">
              Terminal-only output cannot be read from another app. We scan open
              files and common *.log paths under the project directory.
            </p>
          </div>
        ) : logsLoading && processLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
            <RefreshCw className="w-6 h-6 mb-2 animate-spin" />
            <p>Loading logs...</p>
          </div>
        ) : (
          <div className="p-4">
            {highlights.length > 0 && (
              <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-center gap-2 text-warning text-xs font-semibold mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Highlights ({highlights.length} lines)
                </div>
                <div className="max-h-32 overflow-auto font-mono text-[11px] text-text-secondary space-y-1">
                  {highlights.slice(0, 25).map((line, i) => (
                    <div key={i} className="text-danger/90">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="font-mono text-xs leading-relaxed">
              {processLogs.map((line, i) => (
                <div
                  key={i}
                  className={clsx(
                    'py-0.5',
                    line.startsWith('---')
                      ? 'text-accent font-semibold mt-2 first:mt-0'
                      : HIGHLIGHT_RE.test(line)
                        ? 'text-danger/90 bg-danger/5'
                        : 'text-text-secondary'
                  )}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
