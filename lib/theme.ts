export type Theme = 'light' | 'dark'
export type ColorScheme = 'blue' | 'purple' | 'green' | 'orange'
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

export const COLOR_SCHEMES: Record<ColorScheme, Record<string, string>> = {
  blue: {
    primary: '#3B82F6',
    secondary: '#1D4ED8',
    accent: '#10B981',
    light: '#DBEAFE',
  },
  purple: {
    primary: '#8B5CF6',
    secondary: '#6D28D9',
    accent: '#10B981',
    light: '#EDE9FE',
  },
  green: {
    primary: '#10B981',
    secondary: '#059669',
    accent: '#3B82F6',
    light: '#D1FAE5',
  },
  orange: {
    primary: '#F97316',
    secondary: '#EA580C',
    accent: '#3B82F6',
    light: '#FED7AA',
  },
}

export function getThemeStyles(settings: ThemeSettings): string {
  const colors = COLOR_SCHEMES[settings.colorScheme]
  const isDark = settings.theme === 'dark'

  const fontSizeMap = {
    small: '0.9',
    normal: '1',
    large: '1.1',
  }

  return `
    :root {
      --primary: ${colors.primary};
      --secondary: ${colors.secondary};
      --accent: ${colors.accent};
      --primary-light: ${colors.light};
      --neutral-900: ${isDark ? '#F9FAFB' : '#1F2937'};
      --neutral-100: ${isDark ? '#1F2937' : '#F9FAFB'};
      --font-scale: ${fontSizeMap[settings.fontSize]};
      --transition: ${settings.animations ? '0.3s ease' : '0s'};
    }

    body {
      background-color: var(--neutral-100);
      color: var(--neutral-900);
      transition: background-color var(--transition), color var(--transition);
      font-size: calc(16px * var(--font-scale));
    }
  `
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
