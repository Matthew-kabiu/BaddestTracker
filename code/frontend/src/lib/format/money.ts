/**
 * Money is integer minor units (cents) everywhere; only these helpers touch decimals.
 * The currency is the user's choice in Settings; without one, amounts are plain numbers.
 */

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string | null | undefined): Intl.NumberFormat {
  const key = currency ?? ''
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      ...(currency && { style: 'currency', currency }),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    formatters.set(key, f)
  }
  return f
}

/** 15240 → "152.40", or "KES 152.40" / "$152.40" with a currency (grouped per the user's locale). */
export function formatMoney(cents: number, currency?: string | null): string {
  return formatter(currency).format(cents / 100)
}

/** "152.4" / "152.40" / "152" → 15240. Null for anything that is not a non-negative amount. */
export function parseMoney(input: string): number | null {
  const text = input.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
