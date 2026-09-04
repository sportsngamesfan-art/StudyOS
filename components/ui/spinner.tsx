import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  /** `white` for use on a filled button. */
  tone?: 'primary' | 'white'
  className?: string
}

const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }

export function Spinner({ size = 'md', tone = 'primary', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block animate-spin rounded-full border-b-2',
        sizes[size],
        tone === 'white' ? 'border-white' : 'border-primary',
        className
      )}
    />
  )
}

/** Centered spinner for a page or panel that is still loading. */
export function PageSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('text-center py-12', className)}>
      <Spinner />
    </div>
  )
}
