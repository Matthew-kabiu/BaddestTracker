import { useId, useMemo, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Field, FieldDescription, FieldLabel, FieldTitle } from '@/components/kit/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/kit/select'
import { updateUser, useSession } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'
import { formatMoney } from '@/lib/format/money'

// Radix Select can't use "" as a value.
const NONE = 'none'

/** Every ISO 4217 code the browser knows, with its name in the user's language. */
function currencies(): { code: string; name: string }[] {
  const names = new Intl.DisplayNames(undefined, { type: 'currency' })
  return Intl.supportedValuesOf('currency').map((code) => ({ code, name: names.of(code) ?? code }))
}

/** Appearance and money formatting. Theme stays in this browser; currency follows the account. */
export function PreferencesCard() {
  const { data: session } = useSession()
  const [saving, setSaving] = useState(false)
  const options = useMemo(() => currencies(), [])
  const currencyId = useId()
  const currency = session?.user.currency ?? null

  async function setCurrency(value: string) {
    setSaving(true)
    const { error } = await updateUser({ currency: value === NONE ? null : value })
    setSaving(false)
    if (error) return notify.error(null, authErrorMessage(error))
    notify.success(value === NONE ? 'Amounts will show without a currency.' : `Amounts will show in ${value}.`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>How the app looks and how amounts are shown.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Field>
          {/* The toggle group carries its own "Theme" label. */}
          <FieldTitle>Theme</FieldTitle>
          <ThemeSwitcher />
          <FieldDescription>Saved in this browser.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={currencyId}>Currency</FieldLabel>
          <Select value={currency ?? NONE} onValueChange={(v) => void setCurrency(v)} disabled={saving}>
            <SelectTrigger id={currencyId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No currency (plain numbers)</SelectItem>
              {options.map(({ code, name }) => (
                <SelectItem key={code} value={code}>
                  {code} · {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>For example {formatMoney(152_40, currency)}. Shopping and Budget use it.</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}
