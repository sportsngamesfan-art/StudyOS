'use client'

import { useTheme } from '@/components/theme-provider'
import { COLOR_SCHEMES, ColorScheme, FontSize } from '@/lib/theme'
import { useState } from 'react'

// Derived from the single palette source so swatches can never drift from CSS.
const COLOR_SWATCHES = (
  Object.keys(COLOR_SCHEMES) as ColorScheme[]
).map((key) => ({ key, ...COLOR_SCHEMES[key] }))

const FONT_SIZES: { key: FontSize; label: string; px: string }[] = [
  { key: 'small', label: 'Small', px: '14px' },
  { key: 'normal', label: 'Normal', px: '16px' },
  { key: 'large', label: 'Large', px: '18px' },
]

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useTheme()
  const [saved, setSaved] = useState(false)

  const flashSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-ink">Settings</h1>
        <p className="text-muted mt-1">Customize your StudyOS experience</p>
      </div>

      {saved && (
        <div className="p-4 bg-primary-light border border-primary/30 text-primary rounded-lg font-medium transition-theme">
          ✓ Preference updated
        </div>
      )}

      {/* Theme Section */}
      <div className="bg-surface rounded-xl p-6 shadow-sm border border-line transition-theme">
        <h2 className="text-xl font-semibold text-ink mb-4">Appearance</h2>

        <div className="space-y-6">
          {/* Dark mode */}
          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              Theme mode
            </label>
            <div className="flex gap-3">
              {(['light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    updateSettings({ theme: mode })
                    flashSaved()
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-theme border ${
                    settings.theme === mode
                      ? 'bg-primary text-white border-primary'
                      : 'bg-transparent text-ink border-line hover:bg-surface-hover'
                  }`}
                >
                  {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </div>

          {/* Color Scheme */}
          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              Color scheme
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COLOR_SWATCHES.map((scheme) => (
                <button
                  key={scheme.key}
                  onClick={() => {
                    updateSettings({ colorScheme: scheme.key })
                    flashSaved()
                  }}
                  className={`flex items-center gap-2 p-3 rounded-lg font-medium transition-theme border-2 ${
                    settings.colorScheme === scheme.key
                      ? 'border-ink'
                      : 'border-line hover:border-muted'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 border border-black/10"
                    style={{
                      background: `linear-gradient(135deg, ${scheme.primary}, ${scheme.secondary})`,
                    }}
                  />
                  <span className="text-ink text-sm">{scheme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              Font size
            </label>
            <div className="flex gap-3">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.key}
                  onClick={() => {
                    updateSettings({ fontSize: size.key })
                    flashSaved()
                  }}
                  style={{ fontSize: size.px }}
                  className={`px-4 py-2 rounded-lg font-medium transition-theme border ${
                    settings.fontSize === size.key
                      ? 'bg-primary text-white border-primary'
                      : 'bg-transparent text-ink border-line hover:bg-surface-hover'
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">
              Adjusts text size across the whole app
            </p>
          </div>

          {/* Animations */}
          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              Animations &amp; effects
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  updateSettings({ animations: !settings.animations })
                  flashSaved()
                }}
                role="switch"
                aria-checked={settings.animations}
                className={`relative w-12 h-6 rounded-full transition-theme ${
                  settings.animations ? 'bg-primary' : 'bg-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-theme ${
                    settings.animations ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <p className="text-sm text-muted">
                {settings.animations ? 'Smooth transitions enabled' : 'Instant, no animation'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility Section */}
      <div className="bg-surface rounded-xl p-6 shadow-sm border border-line transition-theme">
        <h2 className="text-xl font-semibold text-ink mb-4">Accessibility</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li className="flex items-center gap-2">
            <span className="text-accent">✓</span> High contrast text on all themes
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent">✓</span> Full keyboard navigation
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent">✓</span> Screen reader optimized
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent">✓</span> WCAG 2.1 AA color contrast
          </li>
        </ul>
      </div>

      {/* Reset */}
      <button
        onClick={() => {
          resetSettings()
          flashSaved()
        }}
        className="w-full bg-transparent border border-line text-ink py-3 rounded-lg font-semibold hover:bg-surface-hover transition-theme"
      >
        Reset to Defaults
      </button>

      <div className="bg-primary-light border border-primary/20 rounded-lg p-4 transition-theme">
        <p className="text-sm text-ink">
          💡 Changes apply instantly across StudyOS and are saved to this browser.
        </p>
      </div>
    </div>
  )
}
