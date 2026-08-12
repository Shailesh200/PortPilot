import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { clsx } from 'clsx'
import { ChevronRight } from 'lucide-react'

export function ToolPane({
  title,
  badge,
  actions,
  children,
  className,
  bodyClassName
}: {
  title: string
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-col min-h-0 border border-border-subtle rounded-xl bg-bg-card overflow-hidden',
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle flex-shrink-0">
        <span className="text-[12.5px] font-medium text-text-secondary">
          {title}
        </span>
        {badge}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      <div
        className={clsx(
          'flex-1 min-h-0',
          bodyClassName ?? 'p-4 overflow-auto'
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function ToolToolbar({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-2 mb-4',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Compact segmented control: shows the selected value, expands to the side
 * with a smooth animation to reveal all options, then collapses on pick.
 */
export function ToolSeg<T extends string>({
  options,
  value,
  onChange,
  labels,
  className,
  'aria-label': ariaLabel
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  labels?: Partial<Record<T, string>>
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const labelOf = (opt: T) => labels?.[opt] ?? opt
  const safeValue = options.includes(value) ? value : options[0]
  const single = options.length <= 1

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Close if the option set shrinks to a single choice (e.g. import lock)
  useEffect(() => {
    if (single) setOpen(false)
  }, [single])

  const pick = (opt: T) => {
    onChange(opt)
    setOpen(false)
  }

  if (!safeValue) return null

  if (single) {
    return (
      <div
        className={clsx(
          'inline-flex bg-bg-elevated rounded-full p-0.5 border border-border-strong',
          className
        )}
      >
        <span className="px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap bg-bg-card text-text-primary shadow-sm">
          {labelOf(safeValue)}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={clsx('relative inline-flex max-w-full align-middle', className)}
    >
      <div
        className={clsx(
          'inline-flex max-w-full items-center rounded-full border border-border-strong bg-bg-elevated p-0.5',
          'transition-[box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          open && 'border-accent/35 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.55)]'
        )}
      >
        <button
          type="button"
          aria-label={ariaLabel ?? 'Choose option'}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap',
            'bg-bg-card text-text-primary shadow-sm',
            'transition-colors duration-200',
            'hover:brightness-[1.04] active:scale-[0.98]'
          )}
        >
          <span>{labelOf(safeValue)}</span>
          <ChevronRight
            className={clsx(
              'w-3.5 h-3.5 text-text-muted transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              open && 'rotate-90 text-text-secondary'
            )}
            aria-hidden
          />
        </button>

        <div
          className={clsx(
            'grid min-w-0 transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            open ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]'
          )}
        >
          <div className="min-w-0 overflow-hidden">
            <div
              id={listId}
              role="listbox"
              aria-label={ariaLabel ?? 'Options'}
              className={clsx(
                'flex max-w-[min(70vw,36rem)] items-center gap-0.5 overflow-x-auto pl-0.5 pr-0.5',
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              )}
            >
              {options.map((opt, i) => {
                const selected = opt === safeValue
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={open ? 0 : -1}
                    onClick={() => pick(opt)}
                    className={clsx(
                      'rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap',
                      'transition-[opacity,transform,background-color,color] duration-200',
                      'ease-[cubic-bezier(0.22,1,0.36,1)]',
                      open
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 -translate-x-1 pointer-events-none',
                      selected
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-card/70'
                    )}
                    style={{
                      transitionDelay: open
                        ? `${Math.min(i, 10) * 28}ms`
                        : `${Math.max(0, Math.min(options.length - 1 - i, 8)) * 16}ms`
                    }}
                  >
                    {labelOf(opt)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ToolToggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 cursor-pointer"
    >
      <span
        className={clsx(
          'inline-flex w-9 h-5 rounded-full relative flex-shrink-0 transition-colors',
          checked ? 'bg-accent' : 'bg-bg-hover'
        )}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-[left]"
          style={{ left: checked ? 18 : 2 }}
        />
      </span>
      <span className="text-[13px] text-text-secondary">{label}</span>
    </button>
  )
}

export function ToolBadge({
  children,
  tone = 'info'
}: {
  children: ReactNode
  tone?: 'ok' | 'warn' | 'err' | 'info'
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold',
        tone === 'ok' && 'bg-success/15 text-success',
        tone === 'warn' && 'bg-warning/15 text-warning',
        tone === 'err' && 'bg-danger/15 text-danger',
        tone === 'info' && 'bg-accent/15 text-accent'
      )}
    >
      {children}
    </span>
  )
}

export function ToolButton({
  children,
  onClick,
  variant = 'default',
  disabled,
  title
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 text-[13px] font-medium transition-all disabled:opacity-40',
        variant === 'primary' &&
          'bg-accent text-white font-semibold px-5 py-2.5 rounded-full hover:brightness-110 active:scale-[0.98]',
        variant === 'ghost' &&
          'text-text-secondary hover:text-text-primary px-3 py-2 rounded-full hover:bg-bg-elevated',
        variant === 'danger' &&
          'bg-danger/10 text-danger px-3 py-2 rounded-full hover:bg-danger/20',
        variant === 'default' &&
          'bg-bg-elevated text-text-secondary hover:text-text-primary border border-border-strong px-3 py-1.5 rounded-full'
      )}
    >
      {children}
    </button>
  )
}

export function ToolDivider() {
  return <span className="w-px h-5 bg-border-strong mx-1" />
}
