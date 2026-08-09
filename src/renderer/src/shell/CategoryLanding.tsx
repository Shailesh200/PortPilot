import { ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

export interface CategoryLandingItem {
  id: string
  label: string
  description: string
}

export function CategoryLanding({
  title,
  subtitle,
  items,
  onSelect
}: {
  title: string
  subtitle: string
  items: CategoryLandingItem[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mb-6">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-text-muted mt-1">{subtitle}</p>
      </div>
      <div className="max-w-2xl space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border-subtle',
              'bg-bg-card hover:border-border hover:bg-bg-hover/60 transition-all text-left group'
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{item.label}</p>
              <p className="text-xs text-text-muted mt-0.5 truncate">
                {item.description}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
