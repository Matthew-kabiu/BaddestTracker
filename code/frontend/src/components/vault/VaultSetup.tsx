import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { Button } from '@/components/kit/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Checkbox } from '@/components/kit/checkbox'
import { Field, FieldLabel } from '@/components/kit/field'
import { Spinner } from '@/components/kit/spinner'
import { masterProblem } from '@/components/vault/masterRules'
import { RecoveryCode } from '@/components/vault/RecoveryCode'
import { useVault } from '@/lib/vault/context'

/** First run: choose a master password, then save the recovery key (shown once). */
/** `onStart` fires before set-up so the page keeps this screen up until the key is saved. */
export function VaultSetup({ onStart, onDone }: { onStart: () => void; onDone: () => void }) {
  const vault = useVault()
  const savedId = useId()
  const [master, setMaster] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const problem = masterProblem(master, confirm)
    if (problem) return setError(problem)
    setError(undefined)
    setBusy(true)
    onStart()
    try {
      setCode(await vault.setup(master))
      setMaster('')
      setConfirm('')
    } catch (err) {
      onDone()
      notify.error(err, "We couldn't create your vault.")
    } finally {
      setBusy(false)
    }
  }

  if (code) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-[1.1em] text-primary-ink" />
            Save your recovery key
          </CardTitle>
          <CardDescription>
            If you forget your master password, this key is the only way back in. It is shown once and we cannot see or
            resend it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RecoveryCode code={code} />
          <Field orientation="horizontal">
            <Checkbox id={savedId} checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
            <FieldLabel htmlFor={savedId} className="font-normal">
              I have saved my recovery key somewhere safe
            </FieldLabel>
          </Field>
          <Button className="w-fit" disabled={!saved} onClick={onDone}>
            Open my vault
            <ArrowRight aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto mt-4 w-full overflow-hidden md:w-4/5 xl:w-3/5">
      <CardHeader className="border-b border-primary/15 bg-primary-soft py-7 [.border-b]:pb-7">
        <CardTitle className="flex items-center gap-3 text-xl">
          <ShieldCheck aria-hidden="true" className="size-[1.1em] text-primary-ink" />
          Set up your vault
        </CardTitle>
        <CardDescription>
          Choose a master password, different from the one you sign in with. Your logins are encrypted on this device
          with it before they are saved, so not even the server can read them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={create} className="flex flex-col gap-4">
          <PasswordField label="Master password" value={master} onChange={(e) => setMaster(e.target.value)} autoComplete="new-password" />
          <PasswordField label="Confirm master password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error} autoComplete="new-password" />
          <Button type="submit" className="w-fit" disabled={busy}>
            {busy ? <Spinner aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            {busy ? 'Securing, a few seconds…' : 'Create vault'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
