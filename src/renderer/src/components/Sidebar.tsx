import {
  LayoutDashboard,
  Grid3x3,
  ScrollText,
  Settings,
  ChevronLeft
} from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { useSettingsStore } from '../stores/settingsStore'
import { usePortStore } from '../stores/portStore'
import { clsx } from 'clsx'
import type { ViewType } from '../../../shared/types'

const navItems: {
  id: ViewType
  icon: typeof LayoutDashboard
  label: string
  shortcut: string
}[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: '⌘1' },
  { id: 'heatmap', icon: Grid3x3, label: 'Heatmap', shortcut: '⌘2' },
  { id: 'logs', icon: ScrollText, label: 'Logs', shortcut: '⌘3' }
]

export function Sidebar() {
  const currentView = useUIStore((s) => s.currentView)
  const setView = useUIStore((s) => s.setView)
  const isSidebarCollapsed = useUIStore((s) => s.isSidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const profiles = useSettingsStore((s) => s.profiles)
  const activeProfileId = useSettingsStore((s) => s.activeProfileId)
  const setActiveProfile = useSettingsStore((s) => s.setActiveProfile)
  const setProfileFilter = usePortStore((s) => s.setProfileFilter)

  return (
    <aside
      className={clsx(
        'h-full border-r border-border-subtle bg-bg-surface flex flex-col transition-all duration-200',
        isSidebarCollapsed ? 'w-[60px]' : 'w-[220px]'
      )}
    >
      <nav className="flex-1 p-3 space-y-1">
        <div className="mb-4">
          {!isSidebarCollapsed && (
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2">
              Navigation
            </span>
          )}
        </div>
        {navItems.map(({ id, icon: Icon, label, shortcut }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
              currentView === id
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!isSidebarCollapsed && (
              <>
                <span className="flex-1 text-left">{label}</span>
                <span className="kbd text-[9px]">{shortcut}</span>
              </>
            )}
          </button>
        ))}

        {!isSidebarCollapsed && (
          <div className="pt-6">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2">
              Profiles
            </span>
            <div className="mt-2 space-y-1">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    const newId = activeProfileId === profile.id ? null : profile.id
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
                  <span>{profile.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-border-subtle space-y-1">
        <button
          onClick={() => setView('settings')}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
            currentView === 'settings'
              ? 'bg-accent/10 text-accent'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          )}
        >
          <Settings className="w-4 h-4" />
          {!isSidebarCollapsed && (
            <>
              <span className="flex-1 text-left">Settings</span>
              <span className="kbd text-[9px]">⌘,</span>
            </>
          )}
        </button>
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          <ChevronLeft
            className={clsx(
              'w-4 h-4 transition-transform',
              isSidebarCollapsed && 'rotate-180'
            )}
          />
          {!isSidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
