import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

/**
 * Shared control styling. `bg-background text-ink` is what the old inline
 * inputs were missing, which left them white-on-white in dark mode.
 */
const control =
  'w-full px-4 py-2 bg-background border border-line text-ink rounded-lg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors duration-theme'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(control, className)} {...rest} />
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(control, className)} {...rest}>
        {children}
      </select>
    )
  }
)

interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  className?: string
  children: ReactNode
}

/** Label + control + optional hint, with the required marker rendered once. */
export function Field({ label, htmlFor, required, hint, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  )
}
