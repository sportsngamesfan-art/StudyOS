import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Card } from './card'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  /** Usually a Button or Link pointing at the next thing to do. */
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card padding="lg" className={cn('text-center', className)}>
      {icon && (
        <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && (
        <p className="text-muted text-sm mt-1 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  )
}
