/** Theme preference. "system" follows the OS live (CSS light-dark() + color-scheme, no JS). */
export type Theme = 'light' | 'dark' | 'system'

export const THEMES: readonly Theme[] = ['light', 'dark', 'system']

/** Must match public/theme-init.js, which applies the theme before first paint. */
export const THEME_STORAGE_KEY = 'baddest.theme'

/** Tailwind's color-scheme utilities. index.css colours are light-dark() and resolve from these. */
const SCHEME_CLASS: Record<Theme, string> = {
  light: 'scheme-light',
  dark: 'scheme-dark',
  system: 'scheme-light-dark',
}

export function readTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove(...Object.values(SCHEME_CLASS))
  root.classList.add(SCHEME_CLASS[theme])
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Preference won't persist (storage blocked); it still applies for this session.
  }
}
