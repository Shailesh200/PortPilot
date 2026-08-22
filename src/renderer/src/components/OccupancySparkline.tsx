import { clsx } from 'clsx'
import type { PortOccupancy } from '../lib/portOccupancy'

export function OccupancySparkline({
  occupancy,
  className
}: {
  occupancy?: PortOccupancy
  className?: string
}) {
  const samples = occupancy?.samples ?? []
  if (samples.length < 2) {
    return (
      <span className={clsx('text-[11px] text-text-muted', className)}>
        Collecting…
      </span>
    )
  }

  const w = 120
  const h = 22
  const maxI = Math.max(samples.length - 1, 1)
  const pts = samples
    .map((bit, i) => {
      const x = (i / maxI) * w
      const y = bit ? 4 : h - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={clsx('h-5 w-[120px]', className)}
      aria-label="Port occupancy over recent polls"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
        className="text-accent"
      />
    </svg>
  )
}
