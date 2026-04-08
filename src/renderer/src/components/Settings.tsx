import { useState, type ChangeEventHandler } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { usePortStore } from '../stores/portStore'
import { useUIStore } from '../stores/uiStore'
import {
  Settings as SettingsIcon,
  Monitor,
  Keyboard,
  Bell,
  Shield,
  User,
  Zap,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Download,
  Upload
} from 'lucide-react'
import { clsx } from 'clsx'

type SettingsTab =
  | 'general'
  | 'appearance'
  | 'shortcuts'
  | 'notifications'
  | 'safety'
  | 'profiles'

const tabs: { id: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'safety', label: 'Safety', icon: Shield },
  { id: 'profiles', label: 'Profiles', icon: User }
]

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
        checked ? 'bg-accent' : 'bg-border-strong'
      )}
    >
      <div
        className={clsx(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

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
  const {
    globalShortcut,
    refreshInterval,
    autoOpenBrowser,
    autoFocusTerminal,
    updateSettings
  } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Polling" />
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

      <Divider />
      <SectionHeader title="Global Shortcut" />
      <SettingRow
        label="App launcher shortcut"
        description="System-wide shortcut to show/focus PortPilot"
      >
        <div className="flex items-center gap-2">
          <span className="kbd text-[10px]">{globalShortcut}</span>
          <select
            value={globalShortcut}
            onChange={async (e) => {
              const newShortcut = e.target.value
              const success = await window.api.updateGlobalShortcut(newShortcut)
              if (success) {
                updateSettings({ globalShortcut: newShortcut })
              }
            }}
            className="bg-bg-elevated border border-border-strong rounded-md px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent/50 cursor-pointer"
          >
            <option value="CommandOrControl+Shift+P">⌘⇧P</option>
            <option value="CommandOrControl+Shift+Space">⌘⇧Space</option>
            <option value="CommandOrControl+Shift+L">⌘⇧L</option>
            <option value="CommandOrControl+Alt+P">⌘⌥P</option>
          </select>
        </div>
      </SettingRow>

      <Divider />
      <SectionHeader title="Automation" />

      <SettingRow
        label="Auto-open browser"
        description="Open localhost in browser when a dev server starts"
      >
        <Toggle
          checked={autoOpenBrowser}
          onChange={(v) => updateSettings({ autoOpenBrowser: v })}
        />
      </SettingRow>

      <SettingRow
        label="Auto-focus terminal"
        description="Focus the terminal window when restarting a process"
      >
        <Toggle
          checked={autoFocusTerminal}
          onChange={(v) => updateSettings({ autoFocusTerminal: v })}
        />
      </SettingRow>
    </div>
  )
}

function AppearanceSettings() {
  const { darkMode, updateSettings } = useSettingsStore()

  return (
    <div>
      <SectionHeader title="Theme" />
      <SettingRow
        label="Dark mode"
        description="Switch between dark and light color themes"
      >
        <Toggle
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

const defaultShortcuts = [
  { id: 'global-launcher', label: 'Global Launcher', keys: '⌘ ⇧ P', category: 'Global' },
  { id: 'command-palette', label: 'Command Palette', keys: '⌘ K', category: 'Global' },
  { id: 'nav-dashboard', label: 'Go to Dashboard', keys: '⌘ 1', category: 'Navigation' },
  { id: 'nav-heatmap', label: 'Go to Heatmap', keys: '⌘ 2', category: 'Navigation' },
  { id: 'nav-logs', label: 'Go to Logs', keys: '⌘ 3', category: 'Navigation' },
  { id: 'nav-settings', label: 'Go to Settings', keys: '⌘ ,', category: 'Navigation' },
  { id: 'search-focus', label: 'Focus Search', keys: '/', category: 'Search' },
  { id: 'kill', label: 'Kill Selected Process', keys: 'K', category: 'Actions' },
  { id: 'open-browser', label: 'Open in Browser', keys: 'O', category: 'Actions' },
  { id: 'open-terminal', label: 'Open Terminal', keys: 'T', category: 'Actions' },
  { id: 'open-vscode', label: 'Open in VS Code', keys: 'V', category: 'Actions' },
  {
    id: 'quick-peek',
    label: 'Quick Peek',
    keys: 'Space (global) · ↵ on focused row',
    category: 'Actions'
  },
  { id: 'navigate-up', label: 'Move Up', keys: '↑', category: 'Table' },
  { id: 'navigate-down', label: 'Move Down', keys: '↓', category: 'Table' },
  { id: 'expand-row', label: 'Expand Row', keys: '→', category: 'Table' },
  { id: 'close-modal', label: 'Close / Dismiss', keys: 'Esc', category: 'General' }
]

function ShortcutsSettings() {
  const categories = [...new Set(defaultShortcuts.map((s) => s.category))]

  return (
    <div>
      {categories.map((category) => (
        <div key={category}>
          <SectionHeader title={category} />
          {defaultShortcuts
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
                  {shortcut.keys.split(' ').map((key, i) => (
                    <span key={i} className="kbd text-[10px]">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          <Divider />
        </div>
      ))}
      <p className="text-[11px] text-text-muted mt-4">
        Custom shortcut remapping coming in a future update.
      </p>
    </div>
  )
}

function NotificationsSettings() {
  const {
    cpuThreshold,
    memoryThreshold,
    notifyPortChange,
    notifyHighCpu,
    notifyCrash,
    updateSettings
  } = useSettingsStore()

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
      <SectionHeader title="Toast Notifications" />

      <SettingRow
        label="Port started / stopped"
        description="Notify when a port begins or stops listening"
      >
        <Toggle
          checked={notifyPortChange}
          onChange={(v) => updateSettings({ notifyPortChange: v })}
        />
      </SettingRow>

      <SettingRow
        label="High CPU usage"
        description="Notify when a process exceeds the CPU threshold"
      >
        <Toggle
          checked={notifyHighCpu}
          onChange={(v) => updateSettings({ notifyHighCpu: v })}
        />
      </SettingRow>

      <SettingRow
        label="Crash detected"
        description="Notify when a monitored process crashes"
      >
        <Toggle
          checked={notifyCrash}
          onChange={(v) => updateSettings({ notifyCrash: v })}
        />
      </SettingRow>
    </div>
  )
}

function SafetySettings() {
  const {
    confirmDestructive,
    highlightCritical,
    protectSystemPorts,
    updateSettings
  } = useSettingsStore()
  const { clearHistory } = usePortStore()
  const { resetSettings } = useSettingsStore()
  const { addToast } = useUIStore()

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
      cpuThreshold: state.cpuThreshold,
      memoryThreshold: state.memoryThreshold,
      notifyPortChange: state.notifyPortChange,
      notifyHighCpu: state.notifyHighCpu,
      notifyCrash: state.notifyCrash,
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
        const { updateSettings } = useSettingsStore.getState()
        const { profiles, activeProfileId, ...settings } = data
        updateSettings(settings)
        if (Array.isArray(profiles)) {
          const store = useSettingsStore.getState()
          for (const p of store.profiles) store.removeProfile(p.id)
          for (const p of profiles) store.addProfile(p)
        }
        if (activeProfileId !== undefined) {
          useSettingsStore.getState().setActiveProfile(activeProfileId)
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
        <Toggle
          checked={confirmDestructive}
          onChange={(v) => updateSettings({ confirmDestructive: v })}
        />
      </SettingRow>

      <SettingRow
        label="Highlight critical processes"
        description="Show a shield icon on system-critical ports (22, 80, 443, etc.)"
      >
        <Toggle
          checked={highlightCritical}
          onChange={(v) => updateSettings({ highlightCritical: v })}
        />
      </SettingRow>

      <SettingRow
        label="Protect system ports"
        description="Require force-kill for ports below 1024"
      >
        <Toggle
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

function ProfilesSettings() {
  const { profiles, activeProfileId, addProfile, removeProfile, setActiveProfile } =
    useSettingsStore()
  const { addToast } = useUIStore()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🔧')
  const [newPorts, setNewPorts] = useState('')

  const handleCreate = () => {
    if (!newName.trim()) return
    const id = newName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    const favoritePorts = newPorts
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)

    addProfile({
      id,
      name: newName.trim(),
      icon: newIcon,
      favoritePorts,
      filters: {},
      autoActions: {}
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
        Save port configurations for different workflows. The active profile
        highlights its favorite ports in the dashboard.
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
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  setActiveProfile(
                    activeProfileId === profile.id ? null : profile.id
                  )
                }
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

const tabComponents: Record<SettingsTab, () => JSX.Element> = {
  general: GeneralSettings,
  appearance: AppearanceSettings,
  shortcuts: ShortcutsSettings,
  notifications: NotificationsSettings,
  safety: SafetySettings,
  profiles: ProfilesSettings
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const ActivePanel = tabComponents[activeTab]

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
            onClick={() => setActiveTab(id)}
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
            <Zap className="w-3 h-3" />
            <span>PortPilot v1.0.0</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        <ActivePanel />
      </div>
    </div>
  )
}
