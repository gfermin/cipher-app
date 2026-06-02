'use client'
import { useTheme } from '@/hooks/useTheme'
import { THEME_FAMILIES } from '@/lib/constants'
import type { Theme } from '@/types/app'

const PREVIEW_BG: Record<string, string> = {
  Default: '#07070f',
  'Girly Pink': '#0f0812',
  'Warrior Blue': '#060c12',
  'Natural Green': '#060f08',
  'Passion Red': '#0f0608',
}

const PREVIEW_BG_LIGHT: Record<string, string> = {
  Default: '#f5f5fb',
  'Girly Pink': '#fff5f9',
  'Warrior Blue': '#f0f8ff',
  'Natural Green': '#f0faf4',
  'Passion Red': '#fff5f5',
}

export function ThemeSelector() {
  const { theme, changeTheme } = useTheme()

  return (
    <div className="theme-families">
      {THEME_FAMILIES.map((family) => (
        <div key={family.id}>
          <div className="theme-family-label">{family.id}</div>
          <div className="theme-family-variants">
            {/* Dark variant */}
            <button
              className={`theme-variant-card ${theme === family.dark ? 'active' : ''}`}
              style={{ background: PREVIEW_BG[family.id] ?? '#07070f' }}
              onClick={() => changeTheme(family.dark as Theme)}
            >
              <div
                className="theme-preview"
                style={{ background: PREVIEW_BG[family.id] ?? '#07070f' }}
              >
                <div className="theme-preview-bubble" style={{ width: 32, background: family.accent }} />
                <div className="theme-preview-bubble" style={{ width: 48, background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <div className="theme-variant-name" style={{ color: 'rgba(255,255,255,0.6)' }}>Dark</div>
            </button>

            {/* Light variant */}
            <button
              className={`theme-variant-card ${theme === family.light ? 'active' : ''}`}
              style={{ background: PREVIEW_BG_LIGHT[family.id] ?? '#f5f5fb' }}
              onClick={() => changeTheme(family.light as Theme)}
            >
              <div
                className="theme-preview"
                style={{ background: PREVIEW_BG_LIGHT[family.id] ?? '#f5f5fb' }}
              >
                <div className="theme-preview-bubble" style={{ width: 32, background: family.accent, opacity: 0.85 }} />
                <div className="theme-preview-bubble" style={{ width: 48, background: 'rgba(0,0,0,0.1)' }} />
              </div>
              <div className="theme-variant-name" style={{ color: 'rgba(0,0,0,0.5)' }}>Light</div>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
