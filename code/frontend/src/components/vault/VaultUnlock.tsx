import { KeyRound, LockOpen, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/kit/dialog'
import { Spinner } from '@/components/kit/spinner'
import { masterProblem } from '@/components/vault/masterRules'
import { useVault } from '@/lib/vault/context'
import { WrongSecretError } from '@/lib/vault/crypto'

/** Locked: unlock with the master password, or recover with the recovery key. */
export function VaultUnlock() {
  const vault = useVault()
  const [master, setMaster] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(false)

  async function unlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!master) return setError('Enter your master password')
    setBusy(true)
    try {
      await vault.unlock(master)
      setMaster('')
    } catch (err) {
      if (err instanceof WrongSecretError) setError('That master password is not right')
      else notify.error(err, "We couldn't unlock the vault.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto mt-4 w-full overflow-hidden md:w-4/5 xl:w-3/5">
      <CardHeader className="border-b border-primary/15 bg-primary-soft py-7 [.border-b]:pb-7">
        <CardTitle className="flex items-center gap-3 text-xl">
          <KeyRound aria-hidden="true" className="size-[1.4em] text-primary-ink" />
          Your vault is locked
        </CardTitle>
        <CardDescription>Enter your master password. It never leaves this device.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form noValidate onSubmit={unlock} className="flex flex-col gap-4">
          <PasswordField
            label="Master password"
            value={master}
            onChange={(e) => {
              setMaster(e.target.value)
              setError(undefined)
            }}
            error={error}
            autoComplete="current-password"
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
              {busy ? 'Unlocking…' : 'Unlock'}
            </Button>
            <Button type="button" variant="link" onClick={() => setRecovering(true)}>
              Forgot master password?
            </Button>
          </div>
        </form>
      </CardContent>
      <RecoverDialog open={recovering} onClose={() => setRecovering(false)} />
    </Card>
  )
}

function RecoverDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vault = useVault()
  const [code, setCode] = useState('')
  const [master, setMaster] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)

  async function recover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const problem = masterProblem(master, confirm)
    if (!code.trim()) return setError('Enter your recovery key')
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await vault.recover(code, master)
      notify.success('Vault recovered. Use your new master password from now on.')
      onClose()
    } catch (err) {
      if (err instanceof WrongSecretError) setError('That recovery key is not right')
      else notify.error(err, "We couldn't recover the vault.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recover your vault</DialogTitle>
          <DialogDescription>Enter the recovery key you saved at set-up, then choose a new master password.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={recover} className="flex flex-col gap-4">
          <TextField label="Recovery key" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-..." autoComplete="off" />
          <PasswordField label="New master password" value={master} onChange={(e) => setMaster(e.target.value)} autoComplete="new-password" />
          <PasswordField label="Confirm new master password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error} autoComplete="new-password" />
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="ghost" className="hover:text-danger-ink" onClick={() => setWipeOpen(true)}>
              <Trash2 aria-hidden="true" />
              Lost both? Start over
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
              Recover
            </Button>
          </div>
        </form>
        <ConfirmDialog
          open={wipeOpen}
          title="Start over with an empty vault?"
          description="Without the master password or the recovery key nobody can open the saved logins. Starting over deletes them all for good."
          confirmLabel="Delete everything"
          onCancel={() => setWipeOpen(false)}
          onConfirm={async () => {
            await vault.wipeAll()
            setWipeOpen(false)
            onClose()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
