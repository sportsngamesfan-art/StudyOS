import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Shows a spinner and disables the button. */
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors duration-theme focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-accent text-white hover:bg-accent-hover',
  ghost: 'bg-transparent border border-line text-ink hover:bg-surface-hover',
  danger: 'bg-transparent text-error hover:bg-error/10',
  link: 'bg-transparent text-primary hover:underline',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}

/**
 * Defaults to type="button" so a button inside a form never submits it by
 * accident; pass type="submit" explicitly on the one that should.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    type = 'button',
    children,
    ...rest
  },
  ref
) {
  const filled = variant === 'primary' || variant === 'secondary'
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(base, variants[variant], variant !== 'link' && sizes[size], className)}
      {...rest}
    >
      {loading && <Spinner size="sm" tone={filled ? 'white' : 'primary'} />}
      {children}
    </button>
  )
})
