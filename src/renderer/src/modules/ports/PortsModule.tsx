import { LayoutDashboard, Grid3x3 } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '../../stores/uiStore'
import { Dashboard } from '../../components/Dashboard'
import { Heatmap } from '../../components/Heatmap'
import type { PortsScreen } from '../../../../shared/types'

const portsTabs: {
  id: PortsScreen
  label: string
  icon: typeof LayoutDashboard
  shortcut: string
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
  { id: 'heatmap', label: 'Heatmap', icon: Grid3x3, shortcut: '' }
]

export function PortsModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const rawScreen = nav.module === 'ports' ? (nav.screen as string) : 'dashboard'
  const screen: PortsScreen = rawScreen === 'heatmap' ? 'heatmap' : 'dashboard'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 flex-shrink-0">
        {portsTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setNav({ module: 'ports', screen: id }, false)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              screen === id
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {screen === 'dashboard' && <Dashboard />}
        {screen === 'heatmap' && <Heatmap />}
      </div>
    </div>
  )
}
