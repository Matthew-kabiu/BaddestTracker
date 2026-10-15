import { UserPlus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Spinner } from '@/components/kit/spinner'
import { signUp } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'
import { PAGE_ROUTES } from '@/lib/routes'

// Better Auth's default password policy is 8–128 characters; mirror it for instant feedback.
const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(100, 'That name is too long'),
    email: z.email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(128, 'Use at most 128 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: "Passwords don't match" })

type Fields = z.infer<typeof schema>
type FieldErrors = Partial<Record<keyof Fields, string>>

export default function SignUpPage() {
  const navigate = useNavigate()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = schema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
      confirm: form.get('confirm'),
    })
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors
      setErrors({
        name: flat.name?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
        confirm: flat.confirm?.[0],
      })
      return
    }
    setErrors({})
    setSubmitting(true)
    const { name, email, password } = parsed.data
    const { error } = await signUp.email({ name, email, password })
    setSubmitting(false)
    if (error) {
      notify.error(null, authErrorMessage(error))
      return
    }
    notify.success('Welcome aboard.')
    navigate(PAGE_ROUTES.dashboard.root, { replace: true })
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-fg-muted">It takes less than a minute.</p>
      </header>
      <TextField label="Name" name="name" autoComplete="name" error={errors.name} />
      <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        error={errors.password}
      />
      <PasswordField
        label="Confirm password"
        name="confirm"
        autoComplete="new-password"
        error={errors.confirm}
      />
      <Button type="submit" disabled={submitting} className="mt-1 w-full">
        {submitting ? <Spinner aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        Create account
      </Button>
      <p className="text-center text-sm text-fg-muted">
        Already have an account?{' '}
        <Link to={PAGE_ROUTES.auth.signIn} className="font-medium text-primary-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          Sign in
        </Link>
      </p>
    </form>
  )
}
