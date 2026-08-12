import { useState } from 'react'
import {
  Network,
  FileJson,
  Database,
  Settings,
  Plus
} from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { usePortStore } from '../stores/portStore'
import { clsx } from 'clsx'
import type { ModuleId } from '../../../shared/types'
import { MODULE_REGISTRY } from '../../../shared/modules/registry'

const icons: Record<ModuleId, typeof Network> = {
  ports: Network,
  text: FileJson,
  database: Database,
  settings: Settings
}

const primaryNav = MODULE_REGISTRY.filter((m) => m.id !== 'settings').sort(
  (a, b) => a.order - b.order
)

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const nav = useUIStore((s) => s.nav)
  const openModule = useUIStore((s) => s.openModule)
  const setNav = useUIStore((s) => s.setNav)
  const profiles = useSettingsStore((s) => s.profiles)
  const activeProfileId = useSettingsStore((s) => s.activeProfileId)
  const setActiveProfile = useSettingsStore((s) => s.setActiveProfile)
  const requestOpenProfileCreator = useSettingsStore(
    (s) => s.requestOpenProfileCreator
  )
  const setProfileFilter = usePortStore((s) => s.setProfileFilter)

  const showProfiles = nav.module === 'ports'

  const openAddProfile = () => {
    requestOpenProfileCreator()
    setNav({ module: 'settings', screen: 'profiles' })
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={clsx(
        'h-full border-r border-border-subtle bg-bg-surface flex flex-col transition-all duration-200',
        expanded ? 'w-[220px]' : 'w-[60px]'
      )}
    >
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
        <div className="mb-4">
          {expanded && (
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2">
              Modules
            </span>
          )}
        </div>
        {primaryNav.map((mod) => {
          const Icon = icons[mod.id]
          const active = nav.module === mod.id
          return (
            <button
              key={mod.id}
              onClick={() => openModule(mod.id)}
              title={mod.description}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {expanded && (
                <>
                  <span className="flex-1 text-left truncate">{mod.label}</span>
                  <span className="kbd text-[9px] flex-shrink-0">
                    {mod.shortcut}
                  </span>
                </>
              )}
            </button>
          )
        })}

        {showProfiles && expanded && (
          <div className="pt-6">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2">
              Profiles
            </span>
            <div className="mt-2 space-y-1">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    const newId =
                      activeProfileId === profile.id ? null : profile.id
                    setActiveProfile(newId)
                    if (newId) {
                      setProfileFilter(profile.favoritePorts)
                    } else {
                      setProfileFilter([])
                    }
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all',
                    activeProfileId === profile.id
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <span className="text-base">{profile.icon}</span>
                  <span className="truncate">{profile.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={openAddProfile}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-accent hover:bg-accent/10 transition-all"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Add profile</span>
              </button>
            </div>
          </div>
        )}
        {showProfiles && !expanded && (
          <div className="pt-4">
            <button
              type="button"
              onClick={openAddProfile}
              title="Add profile"
              className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-accent hover:bg-accent/10 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-border-subtle">
        <button
          onClick={() => openModule('settings')}
          title="Settings"
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
            nav.module === 'settings'
              ? 'bg-accent/10 text-accent'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          )}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {expanded && (
            <>
              <span className="flex-1 text-left">Settings</span>
              <span className="kbd text-[9px]">⌘,</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
