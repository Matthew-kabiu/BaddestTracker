import { Check } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { Button } from '@/components/kit/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/kit/dialog'
import { Spinner } from '@/components/kit/spinner'
import { masterProblem } from '@/components/vault/masterRules'
import { useVault } from '@/lib/vault/context'

/** New master password for the same vault. Saved logins and the recovery key stay as they are. */
export function ChangeMasterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vault = useVault()
  const [master, setMaster] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const problem = masterProblem(master, confirm)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await vault.changeMaster(master)
      notify.success('Master password changed.')
      setMaster('')
      setConfirm('')
      onClose()
    } catch (err) {
      notify.error(err, "We couldn't change the master password.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change master password</DialogTitle>
          <DialogDescription>Your saved logins and your recovery key stay the same.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={change} className="flex flex-col gap-4">
          <PasswordField label="New master password" value={master} onChange={(e) => setMaster(e.target.value)} autoComplete="new-password" />
          <PasswordField label="Confirm new master password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error} autoComplete="new-password" />
          <Button type="submit" className="w-fit self-end" disabled={busy}>
            {busy ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
            Change
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
