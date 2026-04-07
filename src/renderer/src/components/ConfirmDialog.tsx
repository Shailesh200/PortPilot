import { useEffect, useRef } from 'react'
import { AlertTriangle, Shield } from 'lucide-react'
import { clsx } from 'clsx'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  variant?: 'danger' | 'warning'
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  variant = 'danger',
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  const Icon = variant === 'danger' ? AlertTriangle : Shield

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[400px] bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={clsx(
              'p-2 rounded-lg flex-shrink-0',
              variant === 'danger' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle bg-bg-card/50">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md bg-bg-elevated text-text-secondary text-xs font-medium hover:text-text-primary transition-colors border border-border-strong"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={clsx(
              'px-3 py-1.5 rounded-md text-white text-xs font-medium transition-colors',
              variant === 'danger' ? 'bg-danger hover:bg-danger/80' : 'bg-warning hover:bg-warning/80'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
