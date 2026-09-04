/** Joins class names, dropping falsy entries. Tiny stand-in for clsx. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
