'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  ThemeSettings,
  DEFAULT_THEME_SETTINGS,
  loadThemeSettings,
  saveThemeSettings,
} from '@/lib/theme'

interface ThemeContextValue {
  settings: ThemeSettings
  updateSettings: (partial: Partial<ThemeSettings>) => void
  resetSettings: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function applyToDocument(settings: ThemeSettings) {
  const root = document.documentElement
  root.classList.toggle('dark', settings.theme === 'dark')
  root.setAttribute('data-scheme', settings.colorScheme)
  root.setAttribute('data-font-size', settings.fontSize)
  root.setAttribute('data-animations', settings.animations ? 'on' : 'off')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS)

  useEffect(() => {
    const loaded = loadThemeSettings()
    setSettings(loaded)
    applyToDocument(loaded)
  }, [])

  const updateSettings = (partial: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      saveThemeSettings(next)
      applyToDocument(next)
      return next
    })
  }

  const resetSettings = () => {
    setSettings(DEFAULT_THEME_SETTINGS)
    saveThemeSettings(DEFAULT_THEME_SETTINGS)
    applyToDocument(DEFAULT_THEME_SETTINGS)
  }

  return (
    <ThemeContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

/** Inline script string, run before paint, to avoid a flash of the wrong theme. */
export const NO_FLASH_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem('themeSettings');
    var settings = raw ? JSON.parse(raw) : {};
    var theme = settings.theme || 'light';
    var colorScheme = settings.colorScheme || 'blue';
    var fontSize = settings.fontSize || 'normal';
    var animations = settings.animations === false ? 'off' : 'on';
    var root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    root.setAttribute('data-scheme', colorScheme);
    root.setAttribute('data-font-size', fontSize);
    root.setAttribute('data-animations', animations);
  } catch (e) {}
})();
`
