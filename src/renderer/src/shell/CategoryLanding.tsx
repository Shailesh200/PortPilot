import {
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties
} from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { clsx } from 'clsx'

export interface CategoryLandingItem {
  id: string
  label: string
  description: string
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>
}

const DEFAULT_ACCENT = '#4F8CFF'

export function CategoryLanding({
  title,
  subtitle,
  items,
  onSelect,
  accent = DEFAULT_ACCENT,
  searchable = true
}: {
  title: string
  subtitle: string
  items: CategoryLandingItem[]
  onSelect: (id: string) => void
  /** Category tint for icon tiles (DevBench Text & Data = blue). */
  accent?: string
  searchable?: boolean
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    )
  }, [items, query])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[960px] px-6 md:px-10 pt-10 pb-16">
        <header className="mb-8">
          <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.02em] text-text-primary">
            {title}
          </h1>
          <p className="mt-1 text-[14px] text-text-secondary">{subtitle}</p>
        </header>

        {searchable && (
          <div className="relative mb-8 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools — try json, diff, convert…"
              className="w-full rounded-full border border-border-subtle bg-bg-card py-3.5 pl-11 pr-5 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[color:var(--cat-accent)] focus:ring-1 focus:ring-[color:var(--cat-accent)]"
              style={{ ['--cat-accent' as string]: accent }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={clsx(
                  'group relative flex min-h-[168px] flex-col items-start rounded-2xl border border-border-subtle bg-bg-card p-5 text-left',
                  'transition-all duration-200',
                  'hover:-translate-y-0.5 hover:border-border-strong hover:bg-bg-hover/70',
                  'hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.55)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cat-accent)]'
                )}
                style={{ ['--cat-accent' as string]: accent }}
              >
                <div className="mb-4 flex w-full items-start justify-between gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: `${accent}1a` }}
                  >
                    {Icon ? (
                      <Icon className="h-5 w-5" style={{ color: accent }} />
                    ) : (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: accent }}
                      />
                    )}
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 text-text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-hover:text-text-secondary"
                    aria-hidden
                  />
                </div>
                <span className="text-[15px] font-semibold tracking-tight text-text-primary">
                  {item.label}
                </span>
                <span className="mt-1.5 line-clamp-3 text-[13px] leading-5 text-text-secondary">
                  {item.description}
                </span>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <p className="text-[14px] text-text-secondary">
            Nothing matches “{query}” — try a shorter word.
          </p>
        )}
      </div>
    </div>
  )
}
