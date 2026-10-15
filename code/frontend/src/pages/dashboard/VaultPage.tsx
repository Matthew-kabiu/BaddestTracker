import { Copy, ExternalLink, KeyRound, Lock, MoreHorizontal, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { useCallback, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { notify } from '@/components/feedback/toast'
import { Button } from '@/components/kit/button'
import { Card, CardContent } from '@/components/kit/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/kit/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/kit/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { Page } from '@/components/layout/Page'
import { ChangeMasterDialog } from '@/components/vault/ChangeMasterDialog'
import { EntryDialog } from '@/components/vault/EntryDialog'
import { VaultSetup } from '@/components/vault/VaultSetup'
import { VaultUnlock } from '@/components/vault/VaultUnlock'
import { copySecret } from '@/lib/vault/clipboard'
import { useVault, type DecryptedItem } from '@/lib/vault/context'

function host(url: string): string {
  try {
    return new URL(url.includes('://') ? url : `https://${url}`).host
  } catch {
    return ''
  }
}

/** Only http(s) links open, so a stored "javascript:" URL can never run. */
function safeHref(url: string): string | null {
  const full = url.includes('://') ? url : `https://${url}`
  return /^https?:\/\//i.test(full) && host(url) ? full : null
}

export default function VaultPage() {
  const vault = useVault()
  const [settingUp, setSettingUp] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ item: DecryptedItem | null } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DecryptedItem | null>(null)
  const [changing, setChanging] = useState(false)
  const closeDelete = useCallback(() => setPendingDelete(null), [])

  async function copy(text: string, what: string) {
    if (!text) return notify.info(`No ${what} saved for this login.`)
    try {
      await copySecret(text)
      notify.success(`${what[0].toUpperCase()}${what.slice(1)} copied. It clears from the clipboard in 30 seconds.`)
    } catch {
      notify.error(null, "We couldn't copy to the clipboard.")
    }
  }

  const q = query.trim().toLowerCase()
  const shown = vault.items
    .filter((i) => !q || [i.entry.title, i.entry.username, i.entry.url].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => a.entry.title.localeCompare(b.entry.title))
  const unlocked = vault.status === 'unlocked' && !settingUp

  const description =
    unlocked
      ? `${vault.items.length} login${vault.items.length === 1 ? '' : 's'}. Locks after 15 minutes idle.`
      : 'Passwords encrypted on your device. Not even the server can read them.'

  const icon = (label: string, onClick: () => void, Icon: typeof Copy, extra = '') => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={label} onClick={onClick} className={extra}>
          <Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )

  return (
    <Page
      title="Vault"
      description={description}
      actions={
        unlocked && (
          <>
            <Button onClick={() => setEditing({ item: null })}>
              <Plus aria-hidden="true" />
              New login
            </Button>
            <Button variant="outline" onClick={vault.lock}>
              <Lock aria-hidden="true" />
              Lock
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="More vault actions">
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setChanging(true)}>
                  <KeyRound aria-hidden="true" />
                  Change master password
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
    >
      {vault.status === 'loading' && <LoadingState label="Loading your vault…" />}
      {vault.status === 'error' && (
        <EmptyState icon={KeyRound} title="We couldn't reach your vault" description="Check your connection and reload the page." />
      )}
      {(vault.status === 'absent' || settingUp) && (
        <VaultSetup onStart={() => setSettingUp(true)} onDone={() => setSettingUp(false)} />
      )}
      {vault.status === 'locked' && <VaultUnlock />}

      {unlocked && (
        <Card className="gap-0 py-0">
          <div className="border-b p-4">
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput aria-label="Search the vault" placeholder="Search by name, username or website" value={query} onChange={(e) => setQuery(e.target.value)} />
            </InputGroup>
          </div>
          <CardContent className="px-0">
            {vault.items.length === 0 ? (
              <EmptyState icon={KeyRound} title="No logins yet" description="Add your first one. It is encrypted before it leaves this device." />
            ) : shown.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-fg-muted">Nothing matches "{query}".</p>
            ) : (
              <ul className="divide-y">
                {shown.map((item) => {
                  const href = safeHref(item.entry.url)
                  return (
                    <li key={item.id} className="group flex items-center gap-4 px-5 py-3 hover:bg-muted/60">
                      <span aria-hidden="true" className="inline-flex size-[2.6em] shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-primary-ink">
                        {item.entry.title.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-fg">{item.entry.title}</span>
                        <span className="truncate text-xs text-fg-subtle">
                          {[item.entry.username, host(item.entry.url)].filter(Boolean).join(' · ') || 'No username'}
                        </span>
                      </span>
                      <span className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                        {icon('Copy username', () => void copy(item.entry.username, 'username'), UserRound)}
                        {icon('Copy password', () => void copy(item.entry.password, 'password'), Copy)}
                        {href && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" asChild>
                                <a href={href} target="_blank" rel="noreferrer noopener" aria-label="Open website">
                                  <ExternalLink aria-hidden="true" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open website</TooltipContent>
                          </Tooltip>
                        )}
                        {icon('Edit', () => setEditing({ item }), Pencil)}
                        {icon('Delete', () => setPendingDelete(item), Trash2, 'hover:text-danger-ink')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <EntryDialog item={editing?.item ?? null} open={editing !== null} onClose={() => setEditing(null)} />
      <ChangeMasterDialog open={changing} onClose={() => setChanging(false)} />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this login?"
        description={pendingDelete ? `"${pendingDelete.entry.title}" will be removed from your vault for good.` : ''}
        onCancel={closeDelete}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await vault.remove(pendingDelete.id)
            closeDelete()
          } catch (err) {
            notify.error(err, "We couldn't delete that login.")
          }
        }}
      />
    </Page>
  )
}
