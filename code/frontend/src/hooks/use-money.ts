import { useSession } from '@/lib/auth/client'
import { formatMoney } from '@/lib/format/money'

/** Formats cents in the signed-in user's currency (set in Settings → Preferences). */
export function useMoney(): (cents: number) => string {
  const { data } = useSession()
  const currency = data?.user.currency
  return (cents) => formatMoney(cents, currency)
}
