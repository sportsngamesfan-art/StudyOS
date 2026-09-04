import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' }

/** The one card style. Pages used to carry two competing variants. */
export function Card({ className, padding = 'md', children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-line shadow-sm transition-theme',
        paddings[padding],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
