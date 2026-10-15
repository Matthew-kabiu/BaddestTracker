// Runs before first paint so the saved theme applies without a flash.
// Kept as a file (not inline) because the CSP forbids inline scripts.
// Must match THEME_STORAGE_KEY and the class names in src/lib/theme/theme.ts.
;(function () {
  var classes = { light: 'scheme-light', dark: 'scheme-dark', system: 'scheme-light-dark' }
  var saved = 'system'
  try {
    var value = window.localStorage.getItem('baddest.theme')
    if (value === 'light' || value === 'dark' || value === 'system') saved = value
  } catch {
    // Storage blocked (private mode): fall back to following the OS.
  }
  var root = document.documentElement
  root.classList.remove('scheme-light', 'scheme-dark', 'scheme-light-dark')
  root.classList.add(classes[saved])
})()
