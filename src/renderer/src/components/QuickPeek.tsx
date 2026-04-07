import { useEffect } from 'react'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  X,
  Trash2,
  Globe,
  Terminal,
  Code2,
  Cpu,
  MemoryStick,
  Clock,
  User
} from 'lucide-react'

export function QuickPeek() {
  const processDetails = usePortStore((s) => s.processDetails)
  const fetchProcessDetails = usePortStore((s) => s.fetchProcessDetails)
  const killPort = usePortStore((s) => s.killPort)
  const openInBrowser = usePortStore((s) => s.openInBrowser)
  const openInTerminal = usePortStore((s) => s.openInTerminal)
  const openInVSCode = usePortStore((s) => s.openInVSCode)
  const filteredPorts = usePortStore((s) => s.filteredPorts)
  const quickPeekPid = useUIStore((s) => s.quickPeekPid)
  const closeQuickPeek = useUIStore((s) => s.closeQuickPeek)
  const addToast = useUIStore((s) => s.addToast)
  const showConfirm = useUIStore((s) => s.showConfirm)
  const confirmDestructive = useSettingsStore((s) => s.confirmDestructive)
  const protectSystemPorts = useSettingsStore((s) => s.protectSystemPorts)

  useEffect(() => {
    if (quickPeekPid) fetchProcessDetails(quickPeekPid)
  }, [quickPeekPid, fetchProcessDetails])

  if (!quickPeekPid) return null

  const port = filteredPorts.find((p) => p.pid === quickPeekPid)
  const details = processDetails

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={closeQuickPeek}
    >
      <div
        className="w-full max-w-[480px] bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              {port?.projectName || port?.command}
              <span className="text-text-muted font-normal ml-2">:{port?.port}</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {port?.command} — PID {port?.pid}
              {port?.projectPath ? ` — ${port.projectPath}` : ''}
            </p>
          </div>
          <button
            onClick={closeQuickPeek}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-card rounded-lg p-3 border border-border-subtle">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Cpu className="w-3.5 h-3.5" />
                <span className="text-xs">CPU Usage</span>
              </div>
              <p className="text-xl font-bold text-text-primary">
                {details?.cpu.toFixed(1) ?? port?.cpu.toFixed(1)}%
              </p>
            </div>
            <div className="bg-bg-card rounded-lg p-3 border border-border-subtle">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <MemoryStick className="w-3.5 h-3.5" />
                <span className="text-xs">Memory</span>
              </div>
              <p className="text-xl font-bold text-text-primary">
                {details?.memory.toFixed(1) ?? port?.memory.toFixed(1)}%
              </p>
            </div>
            <div className="bg-bg-card rounded-lg p-3 border border-border-subtle">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">Uptime</span>
              </div>
              <p className="text-sm font-mono text-text-primary">
                {details?.uptime ?? '—'}
              </p>
            </div>
            <div className="bg-bg-card rounded-lg p-3 border border-border-subtle">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <User className="w-3.5 h-3.5" />
                <span className="text-xs">User</span>
              </div>
              <p className="text-sm font-mono text-text-primary">
                {details?.user ?? port?.user}
              </p>
            </div>
          </div>

          {details?.fullCommand && (
            <div className="bg-bg-card rounded-lg p-3 border border-border-subtle">
              <span className="text-xs text-text-muted">Full Command</span>
              <p className="text-xs font-mono text-text-secondary mt-1 break-all leading-relaxed">
                {details.fullCommand}
              </p>
            </div>
          )}

          {details?.children && details.children.length > 0 && (
            <div className="bg-bg-card rounded-lg p-3 border border-border-subtle">
              <span className="text-xs text-text-muted">
                Child Processes ({details.children.length})
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {details.children.map((cpid) => (
                  <span
                    key={cpid}
                    className="px-1.5 py-0.5 bg-bg-elevated rounded text-xs font-mono text-text-secondary"
                  >
                    {cpid}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-border-subtle bg-bg-card/50">
          <button
            onClick={() => {
              if (!port) return
              if (protectSystemPorts && port.isCritical) {
                addToast({
                  type: 'warning',
                  title: 'Protected Port',
                  message: `Port ${port.port} is protected.`
                })
                return
              }
              const doKill = async () => {
                const success = await killPort(port.pid)
                addToast({
                  type: success ? 'success' : 'error',
                  title: success ? 'Killed' : 'Failed',
                  message: `Port ${port.port}`
                })
                closeQuickPeek()
              }
              if (confirmDestructive) {
                showConfirm({
                  title: 'Kill Process',
                  message: `Kill port ${port.port} (${port.command})?`,
                  confirmLabel: 'Kill',
                  onConfirm: doKill
                })
              } else {
                doKill()
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Kill
          </button>
          {port && (
            <>
              <button
                onClick={() => {
                  openInBrowser(port.port)
                  closeQuickPeek()
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info-muted text-info hover:bg-info/20 text-xs font-medium transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                Browser
              </button>
              <button
                onClick={() => {
                  openInTerminal(port.pid)
                  closeQuickPeek()
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-muted text-success hover:bg-success/20 text-xs font-medium transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />
                Terminal
              </button>
              <button
                onClick={() => {
                  openInVSCode(port.pid)
                  closeQuickPeek()
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-muted text-accent hover:bg-accent/20 text-xs font-medium transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" />
                VS Code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
