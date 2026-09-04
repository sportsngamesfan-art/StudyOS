/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-light': 'var(--color-primary-light)',
        secondary: 'var(--color-secondary)',
        'secondary-hover': 'var(--color-secondary-hover)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        line: 'var(--color-border)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        theme: 'var(--animation-duration, 200ms)',
      },
      // Makes `transition-theme` a real utility. It was used throughout the app
      // but only `duration-theme` had been defined, so it emitted no CSS.
      transitionProperty: {
        theme: 'color, background-color, border-color, box-shadow, transform, opacity',
      },
    },
  },
  plugins: [],
}
module.exports = config
