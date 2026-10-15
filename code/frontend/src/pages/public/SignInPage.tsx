import { LogIn } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'

import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Spinner } from '@/components/kit/spinner'
import { signIn } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'
import { PAGE_ROUTES } from '@/lib/routes'

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

type Fields = z.infer<typeof schema>
type FieldErrors = Partial<Record<keyof Fields, string>>

export default function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = schema.safeParse({ email: form.get('email'), password: form.get('password') })
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors
      setErrors({ email: flat.email?.[0], password: flat.password?.[0] })
      return
    }
    setErrors({})
    setSubmitting(true)
    const { error } = await signIn.email(parsed.data)
    setSubmitting(false)
    if (error) {
      notify.error(null, authErrorMessage(error))
      return
    }
    const from = (location.state as { from?: string } | null)?.from
    navigate(from ?? PAGE_ROUTES.dashboard.root, { replace: true })
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-fg-muted">Sign in to pick up where you left off.</p>
      </header>
      <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        error={errors.password}
      />
      <Button type="submit" disabled={submitting} className="mt-1 w-full">
        {submitting ? <Spinner aria-hidden="true" /> : <LogIn aria-hidden="true" />}
        Sign in
      </Button>
      <p className="text-center text-sm text-fg-muted">
        No account yet?{' '}
        <Link to={PAGE_ROUTES.auth.signUp} className="font-medium text-primary-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          Create one
        </Link>
      </p>
    </form>
  )
}
