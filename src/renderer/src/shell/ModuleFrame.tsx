import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'

export function ModuleFrame({
  title,
  subtitle,
  showBack = false,
  toolbar,
  children
}: {
  title: string
  subtitle?: string
  showBack?: boolean
  toolbar?: ReactNode
  children: ReactNode
}) {
  const goBack = useUIStore((s) => s.goBack)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle flex-shrink-0">
        {showBack && (
          <button
            onClick={goBack}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-text-primary truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {toolbar && <div className="flex items-center gap-2 flex-shrink-0">{toolbar}</div>}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
