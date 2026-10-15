import { Check, Wand2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { TextField } from '@/components/forms/TextField'
import { Button } from '@/components/kit/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/kit/dialog'
import { Field, FieldLabel } from '@/components/kit/field'
import { Spinner } from '@/components/kit/spinner'
import { Textarea } from '@/components/kit/textarea'
import { useVault, type DecryptedItem } from '@/lib/vault/context'
import { generatePassword, type VaultEntry } from '@/lib/vault/crypto'

const EMPTY: VaultEntry = { title: '', url: '', username: '', password: '', notes: '' }

/** Add or edit one login. Everything is encrypted on this device before it is sent. */
export function EntryDialog({ item, open, onClose }: { item: DecryptedItem | null; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit login' : 'New login'}</DialogTitle>
          <DialogDescription>Encrypted on this device before it is saved.</DialogDescription>
        </DialogHeader>
        {open && <EntryForm key={item?.id ?? 'new'} item={item} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EntryForm({ item, onDone }: { item: DecryptedItem | null; onDone: () => void }) {
  const vault = useVault()
  const [entry, setEntry] = useState<VaultEntry>(item?.entry ?? EMPTY)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const set = (k: keyof VaultEntry) => (e: { target: { value: string } }) => setEntry((x) => ({ ...x, [k]: e.target.value }))

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!entry.title.trim()) return setError('Give it a name, e.g. the site')
    setBusy(true)
    try {
      await vault.save({ ...entry, title: entry.title.trim(), url: entry.url.trim() }, item?.id)
      notify.success(item ? 'Login updated.' : 'Login saved.')
      onDone()
    } catch (err) {
      notify.error(err, "We couldn't save that login.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form noValidate onSubmit={save} className="flex flex-col gap-4">
      <TextField label="Name" value={entry.title} onChange={set('title')} error={error} placeholder="Bank, Netflix, Work email…" autoFocus />
      <TextField label="Website" value={entry.url} onChange={set('url')} placeholder="https://" inputMode="url" />
      <TextField label="Username or email" value={entry.username} onChange={set('username')} autoComplete="off" />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <PasswordField label="Password" value={entry.password} onChange={set('password')} autoComplete="new-password" />
        </div>
        <Button type="button" variant="outline" onClick={() => setEntry((x) => ({ ...x, password: generatePassword() }))}>
          <Wand2 aria-hidden="true" />
          Generate
        </Button>
      </div>
      <Field>
        <FieldLabel htmlFor="vault-notes">Notes</FieldLabel>
        <Textarea id="vault-notes" value={entry.notes} onChange={set('notes')} className="min-h-[10vh]" />
      </Field>
      <Button type="submit" className="w-fit self-end" disabled={busy}>
        {busy ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
        Save
      </Button>
    </form>
  )
}
