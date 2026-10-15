import { Check } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { z } from 'zod'

import { notify } from '@/components/feedback/toast'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/kit/card'
import { Spinner } from '@/components/kit/spinner'
import { authClient, changeEmail, updateUser, useSession } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'

// Same rules as sign-up (pages/public/SignUpPage.tsx).
const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'That name is too long'),
  email: z.email('Enter a valid email address'),
})

type Errors = Partial<Record<'name' | 'email', string>>

/** Name and sign-in email. Each is sent only when it changed. */
export function ProfileCard() {
  const { data: session } = useSession()
  const user = session?.user
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  if (!user) return null

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const form = new FormData(e.currentTarget)
    const parsed = schema.safeParse({ name: form.get('name'), email: String(form.get('email') ?? '').trim() })
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors
      return setErrors({ name: flat.name?.[0], email: flat.email?.[0] })
    }
    setErrors({})
    const { name } = parsed.data
    const email = parsed.data.email.toLowerCase()
    if (name === user.name && email === user.email) return notify.success('Nothing to update.')

    setSaving(true)
    try {
      if (name !== user.name) {
        const { error } = await updateUser({ name })
        if (error) return notify.error(null, authErrorMessage(error))
      }
      if (email !== user.email) {
        const { error } = await changeEmail({ newEmail: email })
        if (error) return notify.error(null, authErrorMessage(error))
        // The auth service answers "ok" even when the address belongs to someone else (so it
        // can't be used to discover accounts); the fresh session says whether it really changed.
        const { data } = await authClient.getSession({ query: { disableCookieCache: true } })
        if (data?.user.email !== email) {
          return setErrors({ email: "That email can't be used. It may already belong to another account." })
        }
      }
      notify.success('Profile updated.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name, and the email you sign in with.</CardDescription>
      </CardHeader>
      {/* key: when the session changes elsewhere, the fields start from the new values. */}
      <form key={`${user.name}|${user.email}`} noValidate onSubmit={save} className="flex flex-col gap-6">
        <CardContent className="grid gap-4 md:grid-cols-2">
          <TextField label="Name" name="name" autoComplete="name" defaultValue={user.name} error={errors.name} />
          <TextField label="Email" name="email" type="email" autoComplete="email" defaultValue={user.email} error={errors.email} />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
