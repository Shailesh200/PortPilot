import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export function ToolPane({
  title,
  badge,
  actions,
  children,
  className
}: {
  title: string
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-col min-h-0 border border-border-subtle rounded-xl bg-bg-card overflow-hidden',
        className
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle flex-shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">
          {title}
        </span>
        {badge}
        <div className="flex-1" />
        {actions}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  )
}

export function ToolButton({
  children,
  onClick,
  variant = 'default',
  disabled
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-white hover:bg-accent/90',
        variant === 'danger' && 'bg-danger/10 text-danger hover:bg-danger/20',
        variant === 'default' &&
          'bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-strong'
      )}
    >
      {children}
    </button>
  )
}

export const monoArea =
  'w-full h-full min-h-[200px] resize-none bg-transparent px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none'
