import { type ReactNode, useCallback, useMemo, useState } from 'react'

import { ThemeContext } from '@/lib/theme/context'
import { applyTheme, readTheme, type Theme } from '@/lib/theme/theme'

/** Holds the user's theme choice. The <html> class was already set by theme-init.js before paint. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    setThemeState(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}
