import { LogOut, Monitor, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

import { LoadingState } from '@/components/feedback/LoadingState'
import { notify } from '@/components/feedback/toast'
import { Badge } from '@/components/kit/badge'
import { Button } from '@/components/kit/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Spinner } from '@/components/kit/spinner'
import { listSessions, revokeOtherSessions, revokeSession, useSession } from '@/lib/auth/client'
import { authErrorMessage } from '@/lib/auth/errors'

type SessionRow = NonNullable<Awaited<ReturnType<typeof listSessions>>['data']>[number]

/** "Chrome on Windows" from a user-agent string; good enough to tell your devices apart. */
function describe(userAgent: string | null | undefined): { label: string; mobile: boolean } {
  const ua = userAgent ?? ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null
  const label = browser && os ? `${browser} on ${os}` : browser ?? os ?? 'Unknown device'
  return { label, mobile: /Mobile|Android|iPhone/.test(ua) }
}

/** Newest activity first; null (after a toast) when the list can't be loaded. */
async function fetchSessions(): Promise<SessionRow[] | null> {
  const { data, error } = await listSessions()
  if (error) {
    notify.error(null, "We couldn't load your devices.")
    return null
  }
  return [...data].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Every signed-in device, with sign-out per device or everywhere else. */
export function SessionsCard() {
  const { data: current } = useSession()
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    void fetchSessions().then((rows) => rows && setSessions(rows))
  }, [])

  async function run(key: string, work: () => Promise<{ error: { code?: string; status?: number } | null }>) {
    setBusy(key)
    const { error } = await work()
    setBusy(null)
    if (error) return notify.error(null, authErrorMessage(error))
    const rows = await fetchSessions()
    if (rows) setSessions(rows)
  }

  const currentToken = current?.session.token
  // This device at the top.
  const rows = sessions === null ? null : [...sessions].sort((a, b) => Number(b.token === currentToken) - Number(a.token === currentToken))
  const others = (sessions?.length ?? 1) - 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signed-in devices</CardTitle>
        <CardDescription>Sign out anything you don&apos;t recognise.</CardDescription>
        {others > 0 && (
          <CardAction>
            <Button variant="outline" disabled={busy !== null} onClick={() => void run('others', () => revokeOtherSessions())}>
              {busy === 'others' ? <Spinner aria-hidden="true" /> : <LogOut aria-hidden="true" />}
              Sign out other devices
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <LoadingState label="Loading devices…" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((s) => {
              const { label, mobile } = describe(s.userAgent)
              const Icon = mobile ? Smartphone : Monitor
              const isCurrent = s.token === currentToken
              return (
                <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon aria-hidden="true" className="size-[1.2em] shrink-0 text-fg-subtle" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {label}
                      {isCurrent && <Badge variant="secondary">This device</Badge>}
                    </span>
                    <span className="text-xs text-fg-subtle">
                      Signed in {dateTime.format(new Date(s.createdAt))}
                      {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                    </span>
                  </div>
                  {!isCurrent && (
                    <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void run(s.id, () => revokeSession({ token: s.token }))}>
                      {busy === s.id ? <Spinner aria-hidden="true" /> : <LogOut aria-hidden="true" />}
                      Sign out
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
