import { clsx } from 'clsx'

export function Switch({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border-0 p-0',
        'transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-border-strong',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
      )}
    >
      <span
        className={clsx(
          'pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow',
          'transition-transform duration-200',
          checked && 'translate-x-4'
        )}
      />
    </button>
  )
}
