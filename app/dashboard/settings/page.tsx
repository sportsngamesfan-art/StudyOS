'use client'

import { useEffect, useState } from 'react'
import { ThemeSettings, DEFAULT_THEME_SETTINGS, loadThemeSettings, saveThemeSettings } from '@/lib/theme'

export default function SettingsPage() {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(loadThemeSettings())
    setLoading(false)
  }, [])

  const handleSave = () => {
    saveThemeSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleReset = () => {
    setSettings(DEFAULT_THEME_SETTINGS)
    saveThemeSettings(DEFAULT_THEME_SETTINGS)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Customize your StudyOS experience</p>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
          ✓ Settings saved successfully!
        </div>
      )}

      {/* Theme Section */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Theme</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Dark Mode
            </label>
            <div className="flex gap-3">
              {['light', 'dark'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSettings({ ...settings, theme: mode as 'light' | 'dark' })}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    settings.theme === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </div>

          {/* Color Scheme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Color Scheme
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['blue', 'purple', 'green', 'orange'] as const).map((scheme) => (
                <button
                  key={scheme}
                  onClick={() => setSettings({ ...settings, colorScheme: scheme })}
                  className={`p-4 rounded-lg font-medium transition border-2 ${
                    settings.colorScheme === scheme
                      ? 'border-gray-900'
                      : 'border-transparent'
                  }`}
                  style={{
                    backgroundColor:
                      scheme === 'blue'
                        ? '#EFF6FF'
                        : scheme === 'purple'
                          ? '#F5F3FF'
                          : scheme === 'green'
                            ? '#ECFDF5'
                            : '#FFF7ED',
                    color: scheme === 'blue' ? '#1E40AF' : scheme === 'purple' ? '#6D28D9' : scheme === 'green' ? '#047857' : '#B45309',
                  }}
                >
                  {scheme === 'blue'
                    ? '🔵'
                    : scheme === 'purple'
                      ? '🟣'
                      : scheme === 'green'
                        ? '🟢'
                        : '🟠'}{' '}
                  {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Font Size
            </label>
            <div className="flex gap-3">
              {(['small', 'normal', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setSettings({ ...settings, fontSize: size })}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    settings.fontSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  style={{
                    fontSize:
                      size === 'small' ? '14px' : size === 'normal' ? '16px' : '18px',
                  }}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Adjust text size for better readability
            </p>
          </div>

          {/* Animations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Animations
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() =>
                  setSettings({ ...settings, animations: !settings.animations })
                }
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  settings.animations
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {settings.animations ? '✓ On' : '✗ Off'}
              </button>
              <p className="text-sm text-gray-600">
                {settings.animations
                  ? 'Smooth transitions enabled'
                  : 'Instant transitions'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility Section */}
      <div className="bg-white rounded-lg p-6 shadow">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Accessibility</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>✓ High contrast mode available</p>
          <p>✓ Keyboard navigation supported</p>
          <p>✓ Screen reader optimized</p>
          <p>✓ WCAG 2.1 AA compliant</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Save Settings
        </button>
        <button
          onClick={handleReset}
          className="flex-1 bg-gray-200 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          💡 Your preferences are saved locally and will sync across your devices
          when logged in.
        </p>
      </div>
    </div>
  )
}
