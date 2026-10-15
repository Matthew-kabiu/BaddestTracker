/** Calendar dates as the backend wants them: YYYY-MM-DD in the user's local time zone. */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today in the user's time zone (not UTC). */
export function localToday(): string {
  return toIsoDate(new Date())
}

/** First and last day of the month containing `iso`. */
export function monthRange(iso: string): { from: string; to: string } {
  const [y, m] = iso.split('-').map(Number)
  return { from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) }
}

/** "2026-10-12" → "12 Oct" (local, no time-zone shift). */
export function formatDay(iso: string, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}
