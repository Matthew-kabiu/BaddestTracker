import { KeyRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'

import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { Button } from '@/components/kit/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/kit/card'
import { Checkbox } from '@/components/kit/checkbox'
import { Label } from '@/components/kit/label'
import { Spinner } from '@/components/kit/spinner'
import { changePassword } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'

// Better Auth's default policy is 8–128 characters (same as sign-up).
const schema = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    next: z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: "Passwords don't match" })
  .refine((v) => v.next !== v.current, { path: ['next'], message: 'Choose a password different from the current one' })

type Errors = Partial<Record<'current' | 'next' | 'confirm', string>>

/** Change the sign-in password. The vault's master password is separate and changes in the Vault. */
export function PasswordCard() {
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [signOutOthers, setSignOutOthers] = useState(true)

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const parsed = schema.safeParse({ current: form.get('current'), next: form.get('next'), confirm: form.get('confirm') })
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors
      return setErrors({ current: flat.current?.[0], next: flat.next?.[0], confirm: flat.confirm?.[0] })
    }
    setErrors({})
    setSaving(true)
    const { error } = await changePassword({
      currentPassword: parsed.data.current,
      newPassword: parsed.data.next,
      revokeOtherSessions: signOutOthers,
    })
    setSaving(false)
    if (error) {
      if (error.code === 'INVALID_PASSWORD') return setErrors({ current: 'That is not your current password' })
      return notify.error(null, authErrorMessage(error))
    }
    formEl.reset()
    notify.success(signOutOthers ? 'Password changed. Other devices were signed out.' : 'Password changed.')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>The password you sign in with. Your vault master password is separate.</CardDescription>
      </CardHeader>
      <form noValidate onSubmit={save} className="flex flex-col gap-6">
        <CardContent className="grid gap-4 md:grid-cols-3">
          <PasswordField label="Current password" name="current" autoComplete="current-password" error={errors.current} />
          <PasswordField label="New password" name="next" autoComplete="new-password" error={errors.next} />
          <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" error={errors.confirm} />
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-4">
          <div className="flex items-center gap-2">
            <Checkbox id="sign-out-others" checked={signOutOthers} onCheckedChange={(v) => setSignOutOthers(v === true)} />
            <Label htmlFor="sign-out-others" className="font-normal">Sign out my other devices</Label>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
