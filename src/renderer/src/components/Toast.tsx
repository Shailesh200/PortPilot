import { useUIStore } from '../stores/uiStore'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import type { Toast } from '../../../shared/types'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}

const styles = {
  success: 'border-success/30 bg-success/5',
  error: 'border-danger/30 bg-danger/5',
  warning: 'border-warning/30 bg-warning/5',
  info: 'border-info/30 bg-info/5'
}

const iconStyles = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info'
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUIStore((s) => s.removeToast)
  const Icon = icons[toast.type]

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-xl animate-slide-up max-w-[360px]',
        styles[toast.type]
      )}
    >
      <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', iconStyles[toast.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-text-secondary mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
