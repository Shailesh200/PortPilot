import { useState, useEffect, type ChangeEventHandler, type ReactElement } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import type { AppSettings, Profile, ProfileWorkspace, TextToolId, UpdateInfo } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/defaults'
import { TEXT_TOOLS } from '../../../shared/modules/registry'
import { applyActiveProfileFilter } from '../lib/applyProfile'
import {
  GLOBAL_SHORTCUT_OPTIONS,
  formatAccelerator,
  resolveAppShortcuts
} from '../../../shared/shortcuts'
import {
  Settings as SettingsIcon,
  Monitor,
  Keyboard,
  Shield,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react'
import { clsx } from 'clsx'
import appIcon from '../assets/app-icon.png'
import { Switch } from './Switch'

type SettingsTab = 'general' | 'appearance' | 'shortcuts' | 'safety'

const tabs: { id: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'safety', label: 'Safety', icon: Shield }
]

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-1 mt-6 first:mt-0">
      {title}
    </h3>
  )
}

function Divider() {
  return <div className="border-t border-border-subtle" />
}

function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 h-1 bg-border-strong rounded-full appearance-none cursor-pointer accent-accent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow"
      />
      <span className="text-xs text-text-secondary tabular-nums w-14 text-right">
        {value}
        {suffix}
      </span>
    </div>
  )
}

function SelectInput({
  value,
  options,
  onChange
}: {
  value: string | number
  options: { value: string | number; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg-elevated border border-border-strong rounded-md px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function GeneralSettings() {
  const globalShortcut = useSettingsStore((s) => s.globalShortcut)
  const refreshInterval = useSettingsStore((s) => s.refreshInterval)
  const autoOpenBrowser = useSettingsStore((s) => s.autoOpenBrowser)
  const autoFocusTerminal = useSettingsStore((s) => s.autoFocusTerminal)
  const waitOpenBrowser = useSettingsStore((s) => s.waitOpenBrowser)
  const regexLineByLine = useSettingsStore((s) => s.regexLineByLine)
  const jsPlaygroundAutoRun = useSettingsStore((s) => s.jsPlaygroundAutoRun)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const [clipCapture, setClipCapture] = useState(false)

  useEffect(() => {
    void window.api.clipboardIsCaptureEnabled().then(setClipCapture).catch(() => {})
  }, [])

  return (
    <div>
      <SectionHeader title="Ports" />
      <SettingRow
        label="Refresh interval"
        description="How often to scan for active ports"
      >
        <SelectInput
          value={refreshInterval}
          onChange={(v) => updateSettings({ refreshInterval: Number(v) })}
          options={[
            { value: 1000, label: '1s' },
            { value: 2000, label: '2s' },
            { value: 3000, label: '3s' },
            { value: 5000, label: '5s' },
            { value: 10000, label: '10s' }
          ]}
        />
      </SettingRow>
      <SettingRow
        label="Auto-open browser"
        description="Open localhost in the browser when a new listener starts"
      >
        <Switch
          checked={autoOpenBrowser}
          onChange={(v) => updateSettings({ autoOpenBrowser: v })}
        />
      </SettingRow>
      <SettingRow
        label="Wait for port → open browser"
        description="When Cmd+K wait (or a recently-stopped Wait chip) sees the port come up, open it"
      >
        <Switch
          checked={waitOpenBrowser}
          onChange={(v) => updateSettings({ waitOpenBrowser: v })}
        />
      </SettingRow>
      <SettingRow
        label="Auto-focus terminal"
        description="Focus the terminal window when restarting a process"
      >
        <Switch
          checked={autoFocusTerminal}
          onChange={(v) => updateSettings({ autoFocusTerminal: v })}
        />
      </SettingRow>

      <Divider />
      <NotificationsSettings />

      <Divider />
      <HostsViewer />

      <Divider />
      <SectionHeader title="Text & Data" />
      <SettingRow
        label="Regex: match line by line"
        description="Treat each line as its own test string so ^ and $ work with newlines (toggle also lives in the playground)"
      >
        <Switch
          checked={regexLineByLine}
          onChange={(v) => updateSettings({ regexLineByLine: v })}
        />
      </SettingRow>
      <SettingRow
        label="JS Sandbox auto-run"
        description="Default Auto-run on when you open the sandbox"
      >
        <Switch
          checked={jsPlaygroundAutoRun}
          onChange={(v) => updateSettings({ jsPlaygroundAutoRun: v })}
        />
      </SettingRow>
      <SettingRow
        label="Clipboard capture"
        description="Record copied text into Clipboard history"
      >
        <Switch
          checked={clipCapture}
          onChange={(v) => {
            void window.api.clipboardSetCapture(v).then(setClipCapture)
          }}
        />
      </SettingRow>

      <Divider />
      <SectionHeader title="Database" />
      <p className="text-xs text-text-muted mb-3">
        Destructive SQL still asks for confirmation in the editor. New
        connections can be marked read-only when you create them.
      </p>

      <Divider />
      <SectionHeader title="App" />
      <SettingRow
        label="App launcher shortcut"
        description="System-wide shortcut to show/focus PortPilot"
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            {formatAccelerator(globalShortcut)
              .split(' ')
              .map((key) => (
                <span key={key} className="kbd text-[10px]">
                  {key}
                </span>
              ))}
          </span>
          <select
            value={globalShortcut}
            onChange={async (e) => {
              const newShortcut = e.target.value
              if (newShortcut === 'CommandOrControl+Shift+P') {
                const ok = window.confirm(
                  '⌘⇧P is VS Code’s Command Palette shortcut. Registering it globally will steal that key from VS Code/Cursor while PortPilot is running. Continue?'
                )
                if (!ok) return
              }
              const success = await window.api.updateGlobalShortcut(newShortcut)
              if (success) {
                updateSettings({ globalShortcut: newShortcut })
              }
            }}
            className="bg-bg-elevated border border-border-strong rounded-md px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            {GLOBAL_SHORTCUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </SettingRow>

      <Divider />
      <UpdatesSettings />
    </div>
  )
}

function updateStatusCopy(info: UpdateInfo): string {
  switch (info.status) {
    case 'checking':
      return 'Checking for a new version…'
    case 'available':
      return `New version available — ${info.version}`
    case 'downloading':
      return `Downloading version ${info.version}…`
    case 'downloaded':
      return `Version ${info.version} is ready.`
    case 'not-available':
      return 'You’re on the latest version.'
    case 'error':
      return info.message || 'Could not check for updates.'
    default:
      return 'Check for updates anytime.'
  }
}

function UpdatesSettings() {
  const autoUpdate = useSettingsStore((s) => s.autoUpdate)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.api.getUpdateStatus().then(setInfo).catch(() => {})
    return window.api.onUpdateStatus(setInfo)
  }, [])

  const current = info?.currentVersion
  const status = info?.status
  const checking = status === 'checking'
  const downloading = status === 'downloading'
  const canCheck = !checking && !downloading
  const canDownload = status === 'available' && info?.canInstall === true
  const canRestart = status === 'downloaded'
  const percent =
    downloading && typeof info?.percent === 'number' ? info.percent : null

  const btnSecondary =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated text-text-secondary text-xs font-medium hover:text-text-primary border border-border-strong disabled:opacity-40 disabled:cursor-not-allowed'
  const btnPrimary =
    'px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <>
      <SectionHeader title="Updates" />
      <SettingRow
        label="Auto-update"
        description="Automatically check for new versions."
      >
        <Switch
          checked={autoUpdate}
          onChange={(v) => updateSettings({ autoUpdate: v })}
        />
      </SettingRow>
      <div className="py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary">
              {current ? `Version ${current}` : 'Version'}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {info ? updateStatusCopy(info) : 'Loading update status…'}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {canDownload && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void window.api
                    .downloadUpdate()
                    .then(setInfo)
                    .finally(() => setBusy(false))
                }}
                className={btnPrimary}
              >
                Download and Install
              </button>
            )}
            {canRestart && (
              <button
                type="button"
                onClick={() => void window.api.quitAndInstall()}
                className={btnPrimary}
              >
                Restart PortPilot
              </button>
            )}
            <button
              type="button"
              disabled={!canCheck || busy}
              onClick={() => {
                setBusy(true)
                void window.api
                  .checkForUpdates()
                  .then(setInfo)
                  .finally(() => setBusy(false))
              }}
              className={btnSecondary}
            >
              <RefreshCw
                className={clsx('w-3 h-3', (busy || checking) && 'animate-spin')}
              />
              Check now
            </button>
          </div>
        </div>
        {percent !== null && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-strong">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] tabular-nums text-text-muted">
              {percent}%
            </p>
          </div>
        )}
      </div>
    </>
  )
}

function HostsViewer() {
  const [data, setData] = useState<{
    ok: boolean
    path: string
    lines: { raw: string; ip?: string; names?: string[]; comment?: boolean }[]
    error?: string
  } | null>(null)

  useEffect(() => {
    void window.api.readHostsFile().then(setData).catch(() => {})
  }, [])

  const entries =
    data?.lines.filter((l) => l.ip && l.names && l.names.length > 0) ?? []

  return (
    <div>
      <SectionHeader title="Hosts file" />
      <p className="text-xs text-text-muted mb-3">
        Read-only view of {data?.path ?? '/etc/hosts'}. Editing is not available
        from PortPilot.
      </p>
      {!data ? (
        <p className="text-xs text-text-muted">Loading…</p>
      ) : !data.ok ? (
        <p className="text-xs text-danger">{data.error ?? 'Could not read hosts'}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-text-muted">No host mappings found.</p>
      ) : (
        <div className="max-h-48 overflow-auto rounded-lg border border-border-subtle">
          {entries.map((line, i) => (
            <div
              key={`${line.ip}-${i}`}
              className="flex gap-3 px-3 py-1.5 text-[12px] font-mono border-b border-border-subtle last:border-0"
            >
              <span className="text-accent w-36 flex-shrink-0">{line.ip}</span>
              <span className="text-text-secondary truncate">
                {line.names?.join(' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AppearanceSettings() {
  const darkMode = useSettingsStore((s) => s.darkMode)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  return (
    <div>
      <SectionHeader title="Theme" />
      <SettingRow
        label="Dark mode"
        description="Switch between dark and light color themes"
      >
        <Switch
          checked={darkMode}
          onChange={(v) => updateSettings({ darkMode: v })}
        />
      </SettingRow>

      <Divider />
      <SectionHeader title="Preview" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => updateSettings({ darkMode: true })}
          className={clsx(
            'relative p-3 rounded-lg border-2 transition-all',
            darkMode
              ? 'border-accent bg-accent/5'
              : 'border-border-subtle hover:border-border'
          )}
        >
          <div className="w-full h-20 bg-[#09090b] rounded-md border border-[#27272a] flex flex-col gap-1 p-2">
            <div className="w-12 h-1.5 bg-[#27272a] rounded" />
            <div className="w-8 h-1.5 bg-[#3f3f46] rounded" />
            <div className="w-16 h-1.5 bg-[#27272a] rounded" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-secondary">Dark</span>
            {darkMode && <Check className="w-3.5 h-3.5 text-accent" />}
          </div>
        </button>
        <button
          onClick={() => updateSettings({ darkMode: false })}
          className={clsx(
            'relative p-3 rounded-lg border-2 transition-all',
            !darkMode
              ? 'border-accent bg-accent/5'
              : 'border-border-subtle hover:border-border'
          )}
        >
          <div className="w-full h-20 bg-[#f4f4f5] rounded-md border border-[#d4d4d8] flex flex-col gap-1 p-2">
            <div className="w-12 h-1.5 bg-[#d4d4d8] rounded" />
            <div className="w-8 h-1.5 bg-[#a1a1aa] rounded" />
            <div className="w-16 h-1.5 bg-[#d4d4d8] rounded" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-secondary">Light</span>
            {!darkMode && <Check className="w-3.5 h-3.5 text-accent" />}
          </div>
        </button>
      </div>
    </div>
  )
}

function ShortcutsSettings() {
  const globalShortcut = useSettingsStore((s) => s.globalShortcut)
  const shortcuts = resolveAppShortcuts(globalShortcut)
  const categories = [...new Set(shortcuts.map((s) => s.category))]

  return (
    <div>
      {categories.map((category) => (
        <div key={category}>
          <SectionHeader title={category} />
          {shortcuts
            .filter((s) => s.category === category)
            .map((shortcut) => (
              <div
                key={shortcut.id}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-text-secondary">
                  {shortcut.label}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.split(/\s*·\s*/).map((group, gi) => (
                    <span key={gi} className="flex items-center gap-1">
                      {gi > 0 && (
                        <span className="text-[10px] text-text-muted px-0.5">
                          ·
                        </span>
                      )}
                      {group.split(/\s+/).map((key, i) => (
                        <span key={`${gi}-${i}`} className="kbd text-[10px]">
                          {key}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          <Divider />
        </div>
      ))}
    </div>
  )
}

function NotificationsSettings() {
  const cpuThreshold = useSettingsStore((s) => s.cpuThreshold)
  const memoryThreshold = useSettingsStore((s) => s.memoryThreshold)
  const notifyPortChange = useSettingsStore((s) => s.notifyPortChange)
  const notifyHighCpu = useSettingsStore((s) => s.notifyHighCpu)
  const notifyCrash = useSettingsStore((s) => s.notifyCrash)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  return (
    <div>
      <SectionHeader title="Alert Thresholds" />

      <SettingRow
        label="High CPU threshold"
        description="Show a warning when a process exceeds this CPU usage"
      >
        <SliderInput
          value={cpuThreshold}
          onChange={(v) => updateSettings({ cpuThreshold: v })}
          min={10}
          max={100}
          step={5}
          suffix="%"
        />
      </SettingRow>

      <SettingRow
        label="High memory threshold"
        description="Show a warning when a process exceeds this memory usage"
      >
        <SliderInput
          value={memoryThreshold}
          onChange={(v) => updateSettings({ memoryThreshold: v })}
          min={10}
          max={100}
          step={5}
          suffix="%"
        />
      </SettingRow>

      <Divider />
      <SectionHeader title="Notifications" />

      <SettingRow
        label="Port started / stopped"
        description="In-app toast when focused; system notification when PortPilot is in the background"
      >
        <Switch
          checked={notifyPortChange}
          onChange={(v) => updateSettings({ notifyPortChange: v })}
        />
      </SettingRow>

      <SettingRow
        label="High CPU usage"
        description="In-app toast when a process exceeds the CPU threshold"
      >
        <Switch
          checked={notifyHighCpu}
          onChange={(v) => updateSettings({ notifyHighCpu: v })}
        />
      </SettingRow>

      <SettingRow
        label="Process disappeared"
        description="Alert when a port stops unexpectedly (not after you kill/restart it). Uses a system notification when the app is in the background"
      >
        <Switch
          checked={notifyCrash}
          onChange={(v) => updateSettings({ notifyCrash: v })}
        />
      </SettingRow>
    </div>
  )
}

function SafetySettings() {
  const confirmDestructive = useSettingsStore((s) => s.confirmDestructive)
  const highlightCritical = useSettingsStore((s) => s.highlightCritical)
  const protectSystemPorts = useSettingsStore((s) => s.protectSystemPorts)
  const hideSystemProcesses = useSettingsStore((s) => s.hideSystemProcesses)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const clearHistory = usePortStore((s) => s.clearHistory)
  const resetSettings = useSettingsStore((s) => s.resetSettings)
  const addToast = useUIStore((s) => s.addToast)
  const showConfirm = useUIStore((s) => s.showConfirm)

  const handleExportSettings = () => {
    const state = useSettingsStore.getState()
    const data = {
      globalShortcut: state.globalShortcut,
      refreshInterval: state.refreshInterval,
      darkMode: state.darkMode,
      autoOpenBrowser: state.autoOpenBrowser,
      autoFocusTerminal: state.autoFocusTerminal,
      confirmDestructive: state.confirmDestructive,
      highlightCritical: state.highlightCritical,
      protectSystemPorts: state.protectSystemPorts,
      hideSystemProcesses: state.hideSystemProcesses,
      cpuThreshold: state.cpuThreshold,
      memoryThreshold: state.memoryThreshold,
      notifyPortChange: state.notifyPortChange,
      notifyHighCpu: state.notifyHighCpu,
      notifyCrash: state.notifyCrash,
      pinnedTextTools: state.pinnedTextTools,
      regexLineByLine: state.regexLineByLine,
      jsPlaygroundAutoRun: state.jsPlaygroundAutoRun,
      waitOpenBrowser: state.waitOpenBrowser,
      autoUpdate: state.autoUpdate,
      profiles: state.profiles,
      activeProfileId: state.activeProfileId
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'portpilot-settings.json'
    a.click()
    URL.revokeObjectURL(url)
    addToast({ type: 'success', title: 'Settings Exported' })
  }

  const handleImportSettings: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!data || typeof data !== 'object') throw new Error('invalid')

        // Only accept known AppSettings keys with matching types — a
        // hostile/garbled JSON file used to clobber the store with junk.
        const sanitized: Partial<AppSettings> = {}
        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
          const expected = typeof DEFAULT_SETTINGS[key]
          if (typeof data[key] === expected) {
            ;(sanitized as Record<string, unknown>)[key] = data[key]
          }
        }
        useSettingsStore.getState().updateSettings(sanitized)

        if (Array.isArray(data.profiles)) {
          const profiles = (data.profiles as unknown[])
            .filter((p): p is Profile => {
              return (
                !!p &&
                typeof p === 'object' &&
                typeof (p as Profile).id === 'string' &&
                typeof (p as Profile).name === 'string' &&
                Array.isArray((p as Profile).favoritePorts)
              )
            })
            .map((p) => ({
              id: p.id,
              name: p.name,
              icon: typeof p.icon === 'string' ? p.icon : '🔧',
              favoritePorts: p.favoritePorts.filter(
                (n) => typeof n === 'number' && n > 0 && n <= 65535
              ),
              filters:
                typeof p.filters === 'object' && p.filters ? p.filters : {},
              autoActions:
                typeof p.autoActions === 'object' && p.autoActions
                  ? p.autoActions
                  : {}
            }))
          const aid =
            data.activeProfileId === null ||
            typeof data.activeProfileId === 'string'
              ? data.activeProfileId
              : null
          useSettingsStore.getState().applyLoadedProfiles(profiles, aid)
          void window.api.saveProfiles({ profiles, activeProfileId: aid })
          const pr = aid && profiles.find((p) => p.id === aid)
          if (pr?.favoritePorts) {
            usePortStore.getState().setProfileFilter(pr.favoritePorts)
          } else {
            usePortStore.getState().setProfileFilter([])
          }
          usePortStore.getState().reapplyFiltersAndSort()
        }
        addToast({
          type: 'success',
          title: 'Settings Imported',
          message: 'All settings restored from file'
        })
      } catch {
        addToast({
          type: 'error',
          title: 'Import Failed',
          message: 'Invalid settings file'
        })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div>
      <SectionHeader title="Destructive Actions" />

      <SettingRow
        label="Confirm before killing"
        description="Show a confirmation dialog before killing a process"
      >
        <Switch
          checked={confirmDestructive}
          onChange={(v) => updateSettings({ confirmDestructive: v })}
        />
      </SettingRow>

      <SettingRow
        label="Highlight critical processes"
        description="Show a shield icon on system-critical ports (22, 80, 443, etc.)"
      >
        <Switch
          checked={highlightCritical}
          onChange={(v) => updateSettings({ highlightCritical: v })}
        />
      </SettingRow>

      <SettingRow
        label="Hide system processes"
        description="Hide OS daemons (AirPlay, mDNS, Windows services, etc.) on the Ports dashboard. Local databases and language runtimes stay visible."
      >
        <Switch
          checked={hideSystemProcesses}
          onChange={(v) => {
            updateSettings({ hideSystemProcesses: v })
            queueMicrotask(() =>
              usePortStore.getState().reapplyFiltersAndSort()
            )
          }}
        />
      </SettingRow>

      <SettingRow
        label="Protect system ports"
        description="Block kill/restart for system & well-known ports (below 1024, plus 5432, 3306, 6379, etc.)"
      >
        <Switch
          checked={protectSystemPorts}
          onChange={(v) => updateSettings({ protectSystemPorts: v })}
        />
      </SettingRow>

      <Divider />
      <SectionHeader title="Data" />

      <SettingRow
        label="Clear action history"
        description="Remove all recorded kill, restart, and open actions"
      >
        <button
          onClick={() => {
            clearHistory()
            addToast({
              type: 'success',
              title: 'History Cleared',
              message: 'All action history has been removed'
            })
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-danger/10 text-danger hover:bg-danger/20 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </SettingRow>

      <SettingRow
        label="Reset all settings"
        description="Restore every setting to its default value"
      >
        <button
          onClick={() => {
            resetSettings()
            addToast({
              type: 'info',
              title: 'Settings Reset',
              message: 'All settings restored to defaults'
            })
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated text-text-secondary hover:text-text-primary text-xs font-medium transition-colors border border-border-strong"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </SettingRow>

      <SettingRow
        label="Erase all PortPilot data"
        description="Delete connections, saved passwords, query history, clipboard, and settings, then quit. Dragging the app to Trash on Mac does not remove this data."
      >
        <button
          onClick={() => {
            showConfirm({
              title: 'Erase all PortPilot data?',
              message:
                'This permanently deletes local PortPilot data, including database passwords, then quits. This cannot be undone.',
              variant: 'danger',
              confirmLabel: 'Erase and quit',
              onConfirm: () => {
                void window.api.eraseAllAppData()
              }
            })
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-danger/10 text-danger hover:bg-danger/20 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Erase
        </button>
      </SettingRow>

      <Divider />
      <SectionHeader title="Backup" />

      <SettingRow
        label="Export settings"
        description="Download all settings and profiles as a JSON file"
      >
        <button
          onClick={handleExportSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 text-xs font-medium transition-colors"
        >
          <Download className="w-3 h-3" />
          Export
        </button>
      </SettingRow>

      <SettingRow
        label="Import settings"
        description="Restore settings from a previously exported JSON file"
      >
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-elevated text-text-secondary hover:text-text-primary text-xs font-medium transition-colors border border-border-strong cursor-pointer">
          <Upload className="w-3 h-3" />
          Import
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportSettings}
          />
        </label>
      </SettingRow>
    </div>
  )
}

const PROFILE_ICONS = ['🎨', '⚙️', '🗄️', '🌐', '🧪', '📦', '🔧', '🚀', '💻', '🔌']

function ProfilesSettings({ startCreating = false }: { startCreating?: boolean }) {
  const profiles = useSettingsStore((s) => s.profiles)
  const activeProfileId = useSettingsStore((s) => s.activeProfileId)
  const addProfile = useSettingsStore((s) => s.addProfile)
  const removeProfile = useSettingsStore((s) => s.removeProfile)
  const setActiveProfile = useSettingsStore((s) => s.setActiveProfile)
  const addToast = useUIStore((s) => s.addToast)
  const hideSystemProcesses = useSettingsStore((s) => s.hideSystemProcesses)
  const [isCreating, setIsCreating] = useState(startCreating)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🔧')
  const [newPorts, setNewPorts] = useState('')
  const [snapshotWorkspace, setSnapshotWorkspace] = useState(true)
  const [openOnActivate, setOpenOnActivate] = useState<
    'stay' | 'ports' | 'text' | 'database'
  >('stay')
  const [textTool, setTextTool] = useState<TextToolId>('json-formatter')

  const handleCreate = () => {
    if (!newName.trim()) return
    const id = newName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    const favoritePorts = newPorts
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)

    const workspace: ProfileWorkspace | undefined = snapshotWorkspace
      ? {
          hideSystemProcesses,
          portView: usePortStore.getState().portView,
          groupByProject: usePortStore.getState().groupByProject,
          ...(openOnActivate === 'stay'
            ? {}
            : { openOnActivate }),
          ...(openOnActivate === 'text' ? { textTool } : {})
        }
      : openOnActivate === 'stay'
        ? undefined
        : {
            openOnActivate,
            ...(openOnActivate === 'text' ? { textTool } : {})
          }

    addProfile({
      id,
      name: newName.trim(),
      icon: newIcon,
      favoritePorts,
      filters: {},
      autoActions: {},
      workspace
    })
    addToast({ type: 'success', title: 'Profile Created', message: newName.trim() })
    setIsCreating(false)
    setNewName('')
    setNewPorts('')
  }

  return (
    <div>
      <SectionHeader title="Developer Profiles" />
      <p className="text-xs text-text-muted mb-4">
        Favorite ports define which rows rise to the top and which ports are shown
        when a profile is active. A workspace snapshot can restore listeners vs
        connections, hide-system, grouping, and which module opens. Add ports from
        the dashboard actions menu or the menu bar. Empty favorites = show all
        ports when active.
      </p>

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={clsx(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              activeProfileId === profile.id
                ? 'border-accent/40 bg-accent/5'
                : 'border-border-subtle hover:border-border'
            )}
          >
            <span className="text-xl">{profile.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {profile.name}
              </p>
              <p className="text-[11px] text-text-muted">
                Ports:{' '}
                {profile.favoritePorts.length > 0
                  ? profile.favoritePorts.join(', ')
                  : 'None'}
                {profile.workspace?.openOnActivate
                  ? ` · opens ${profile.workspace.openOnActivate}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const next = activeProfileId === profile.id ? null : profile.id
                  setActiveProfile(next)
                  queueMicrotask(() => applyActiveProfileFilter())
                }}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  activeProfileId === profile.id
                    ? 'bg-accent text-white'
                    : 'bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-strong'
                )}
              >
                {activeProfileId === profile.id ? 'Active' : 'Activate'}
              </button>
              <button
                onClick={() => {
                  removeProfile(profile.id)
                  if (activeProfileId === profile.id) setActiveProfile(null)
                  addToast({
                    type: 'info',
                    title: 'Profile Removed',
                    message: profile.name
                  })
                }}
                className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger-muted transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isCreating ? (
        <div className="mt-4 p-4 rounded-lg border border-accent/30 bg-accent/5 space-y-3">
          <p className="text-xs font-semibold text-text-primary">
            New Profile
          </p>
          <div>
            <label className="text-[11px] text-text-muted mb-1 block">
              Icon
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {PROFILE_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className={clsx(
                    'w-8 h-8 rounded-md flex items-center justify-center text-base transition-all',
                    newIcon === icon
                      ? 'bg-accent/20 ring-1 ring-accent'
                      : 'bg-bg-elevated hover:bg-bg-hover'
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-text-muted mb-1 block">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Fullstack Dev"
              className="w-full bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="text-[11px] text-text-muted mb-1 block">
              Favorite Ports (comma-separated)
            </label>
            <input
              type="text"
              value={newPorts}
              onChange={(e) => setNewPorts(e.target.value)}
              placeholder="e.g. 3000, 5173, 8080"
              className="w-full bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={snapshotWorkspace}
              onChange={(e) => setSnapshotWorkspace(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Remember current Ports view (listeners vs connections, hide
              system, group by project)
            </span>
          </label>
          <div>
            <label className="text-[11px] text-text-muted mb-1 block">
              When activated, open
            </label>
            <select
              value={openOnActivate}
              onChange={(e) =>
                setOpenOnActivate(
                  e.target.value as 'stay' | 'ports' | 'text' | 'database'
                )
              }
              className="w-full bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
            >
              <option value="stay">Stay on current screen</option>
              <option value="ports">Ports dashboard</option>
              <option value="text">Text & Data tool</option>
              <option value="database">Database</option>
            </select>
          </div>
          {openOnActivate === 'text' && (
            <div>
              <label className="text-[11px] text-text-muted mb-1 block">
                Default text tool
              </label>
              <select
                value={textTool}
                onChange={(e) => setTextTool(e.target.value as TextToolId)}
                className="w-full bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
              >
                {TEXT_TOOLS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Profile
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-md bg-bg-elevated text-text-secondary text-xs font-medium hover:text-text-primary transition-colors border border-border-strong"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border-strong text-text-muted hover:text-text-primary hover:border-border hover:bg-bg-hover/50 transition-all text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Profile
        </button>
      )}
    </div>
  )
}

const tabComponents: Record<SettingsTab, () => ReactElement> = {
  general: GeneralSettings,
  appearance: AppearanceSettings,
  shortcuts: ShortcutsSettings,
  safety: SafetySettings
}

export function Settings() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const navScreen =
    nav.module === 'settings' &&
    (nav.screen === 'general' ||
      nav.screen === 'appearance' ||
      nav.screen === 'shortcuts' ||
      nav.screen === 'safety')
      ? nav.screen
      : 'general'
  const [activeTab, setActiveTab] = useState<SettingsTab>(navScreen)
  const [appVersion, setAppVersion] = useState('')
  const ActivePanel = tabComponents[activeTab]

  useEffect(() => {
    if (nav.module !== 'settings') return
    if (nav.screen in tabComponents) {
      setActiveTab(nav.screen as SettingsTab)
    } else {
      setActiveTab('general')
    }
  }, [nav])

  useEffect(() => {
    void window.api.getAppVersion().then(setAppVersion).catch(() => {})
  }, [])

  return (
    <div className="h-full flex overflow-hidden" data-skip-port-shortcuts>
      <div className="w-[200px] border-r border-border-subtle bg-bg-surface/50 p-3 flex flex-col gap-0.5 overflow-y-auto">
        <div className="px-2 py-3 mb-1">
          <h2 className="text-base font-bold text-text-primary">Settings</h2>
          <p className="text-[11px] text-text-muted mt-0.5">
            Configure PortPilot
          </p>
        </div>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id)
              setNav({ module: 'settings', screen: id }, false)
            }}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
              activeTab === id
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="px-2 pt-3 mt-2 border-t border-border-subtle">
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <img src={appIcon} alt="" className="w-3.5 h-3.5 rounded-[3px]" />
            <span>PortPilot{appVersion ? ` v${appVersion}` : ''}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ActivePanel />
      </div>
    </div>
  )
}

/** Create / manage profiles without a Settings tab. */
export function ProfileCreatorDialog() {
  const open = useSettingsStore((s) => s.openProfileCreator)
  const clear = useSettingsStore((s) => s.clearOpenProfileCreator)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={clear}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-border bg-bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-primary">Profiles</h2>
          <button
            type="button"
            onClick={clear}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Close
          </button>
        </div>
        <ProfilesSettings startCreating />
      </div>
    </div>
  )
}
