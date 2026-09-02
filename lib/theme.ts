export type Theme = 'light' | 'dark'
export type ColorScheme = 'blue' | 'black' | 'sky' | 'indigo'
export type FontSize = 'small' | 'normal' | 'large'

export interface ThemeSettings {
  theme: Theme
  colorScheme: ColorScheme
  fontSize: FontSize
  animations: boolean
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  theme: 'light',
  colorScheme: 'blue',
  fontSize: 'normal',
  animations: true,
}

/**
 * Swatches shown in Settings. The real colors live in globals.css under the
 * matching [data-scheme='...'] block — these are just previews of them.
 */
export const COLOR_SCHEMES: Record<
  ColorScheme,
  { label: string; primary: string; secondary: string }
> = {
  blue: { label: 'Blue', primary: '#2563EB', secondary: '#0F172A' },
  black: { label: 'Black', primary: '#0F172A', secondary: '#000000' },
  sky: { label: 'Sky', primary: '#0284C7', secondary: '#0F172A' },
  indigo: { label: 'Indigo', primary: '#4338CA', secondary: '#0F172A' },
}

export function saveThemeSettings(settings: ThemeSettings): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('themeSettings', JSON.stringify(settings))
  }
}

export function loadThemeSettings(): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_THEME_SETTINGS

  const saved = localStorage.getItem('themeSettings')
  if (!saved) return DEFAULT_THEME_SETTINGS

  try {
    return { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(saved) }
  } catch {
    return DEFAULT_THEME_SETTINGS
  }
}
