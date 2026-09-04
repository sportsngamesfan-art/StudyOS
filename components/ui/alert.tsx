import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface AlertProps {
  variant?: 'error' | 'success' | 'info'
  children: ReactNode
  onDismiss?: () => void
  className?: string
}

const styles = {
  error: 'bg-error/10 border-error/30 text-error',
  success: 'bg-success/10 border-success/30 text-success',
  info: 'bg-primary-light border-primary/30 text-ink',
}

export function Alert({ variant = 'info', children, onDismiss, className }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'p-4 border rounded-lg text-sm flex items-start justify-between gap-4',
        styles[variant],
        className
      )}
    >
      <div className="min-w-0">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 leading-none text-lg opacity-70 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  )
}
