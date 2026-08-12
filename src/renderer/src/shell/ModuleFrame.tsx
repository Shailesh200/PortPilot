import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { clsx } from 'clsx'
import { WorkspaceToolbarSlotProvider } from './WorkspaceToolbar'

export function ModuleFrame({
  title,
  subtitle,
  showBack = false,
  backLabel = 'Back',
  onBack,
  toolbar,
  leading,
  children,
  /**
   * `bench` — DevBench marketing-style scroll page.
   * `workspace` — full-bleed editor: compact header, children fill remaining height.
   */
  variant = 'default',
  wide = true
}: {
  title: string
  subtitle?: string
  showBack?: boolean
  backLabel?: string
  /** Overrides stack goBack — use for category “home” navigation. */
  onBack?: () => void
  toolbar?: ReactNode
  /** Sits immediately after the title (left side). Use for identity/switchers. */
  leading?: ReactNode
  children: ReactNode
  variant?: 'default' | 'bench' | 'workspace'
  wide?: boolean
}) {
  const goBack = useUIStore((s) => s.goBack)
  const handleBack = onBack ?? goBack
  const immersive = useUIStore((s) => s.isWorkspaceImmersive)

  if (variant === 'workspace') {
    return (
      <WorkspaceToolbarSlotProvider>
        {(slotRef) => (
          <div className="h-full flex flex-col overflow-hidden">
            <header
              className={clsx(
                'flex-shrink-0 px-3 border-b border-border-subtle',
                immersive ? 'pt-1.5 pb-1.5' : 'pt-2 pb-2'
              )}
            >
              {!immersive && (
                <div className="flex items-center gap-2 min-h-[28px]">
                  {showBack && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors group flex-shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 mr-1 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="text-[12px] font-medium">{backLabel}</span>
                    </button>
                  )}
                  <h1 className="text-[13px] font-semibold tracking-tight text-text-primary truncate">
                    {title}
                  </h1>
                  {leading && (
                    <div className="flex min-w-0 items-center gap-2 flex-shrink">
                      {leading}
                    </div>
                  )}
                  {toolbar && (
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      {toolbar}
                    </div>
                  )}
                </div>
              )}
              <div
                ref={slotRef}
                className={clsx(
                  'empty:hidden empty:mt-0 [&:not(:empty)]:min-h-0',
                  !immersive && 'mt-2'
                )}
              />
            </header>
            <div
              className={clsx(
                'flex-1 min-h-0 overflow-hidden',
                immersive ? 'p-1.5' : 'p-2'
              )}
            >
              {children}
            </div>
          </div>
        )}
      </WorkspaceToolbarSlotProvider>
    )
  }

  if (variant === 'bench') {
    return (
      <div className="h-full overflow-y-auto">
        <div
          className={clsx(
            'mx-auto px-6 md:px-12 pt-10 pb-16',
            wide ? 'max-w-5xl' : 'max-w-[760px]'
          )}
        >
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center text-text-secondary hover:text-text-primary transition-colors mb-4 group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-[13px] font-medium">{backLabel}</span>
            </button>
          )}
          <div className="flex items-start gap-4 mb-8">
            <div className="flex-1 min-w-0">
              <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.02em] text-text-primary">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[14px] text-text-secondary mt-1">{subtitle}</p>
              )}
            </div>
            {toolbar && (
              <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                {toolbar}
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle flex-shrink-0">
        {showBack && (
          <button
            onClick={handleBack}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-h-0">
          <h1 className="text-base font-bold text-text-primary truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {toolbar && (
          <div className="flex items-center gap-2 flex-shrink-0">{toolbar}</div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
