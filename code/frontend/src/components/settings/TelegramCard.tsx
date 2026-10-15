import { CheckCircle2, ExternalLink, Link2, Send, Unlink } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { LoadingState } from '@/components/feedback/LoadingState'
import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { Badge } from '@/components/kit/badge'
import { Button } from '@/components/kit/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Spinner } from '@/components/kit/spinner'
import { apiClient } from '@/lib/api/apiClient'
import type { TelegramStatus } from '@/types/api'

/** Optional: reminders and alerts through the user's own Telegram bot. */
export function TelegramCard() {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<'save' | 'confirm' | 'test' | 'remove' | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    apiClient.telegram.status().then(setStatus, (err: unknown) => notify.error(err, "We couldn't load Telegram settings."))
  }, [])

  /** Run one step; `failure` is the toast if it fails (step-specific, so it says what to do). */
  async function act<T>(kind: NonNullable<typeof busy>, work: () => Promise<T>, done: (r: T) => void, failure: string) {
    setBusy(kind)
    try {
      done(await work())
      setError(undefined)
    } catch {
      notify.error(null, failure)
    } finally {
      setBusy(null)
    }
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = token.trim()
    if (!value) return setError('Paste the token BotFather gave you')
    if (!/^\d+:[\w-]{30,}$/.test(value)) return setError('That does not look like a bot token. It looks like 123456789:AA...')
    void act(
      'save',
      () => apiClient.telegram.setBot(value),
      (s) => {
        setStatus(s)
        setToken('')
      },
      'Telegram did not accept that token. Copy it again from BotFather.',
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram</CardTitle>
        <CardDescription>Get reminders and budget alerts in Telegram as well as in the app. Optional.</CardDescription>
        {status?.linked && (
          <CardAction>
            <Badge variant="secondary">
              <CheckCircle2 aria-hidden="true" />
              Connected
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status === null ? (
          <LoadingState label="Loading…" />
        ) : status.linked ? (
          <>
            <p className="text-sm text-fg-muted">
              Delivering through <span className="font-medium text-fg">@{status.botUsername}</span>.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy !== null} onClick={() => void act('test', () => apiClient.telegram.test(), () => notify.success('Test message sent.'), 'The test did not arrive. Check the bot still exists.')}>
                {busy === 'test' ? <Spinner aria-hidden="true" /> : <Send aria-hidden="true" />}
                Send a test
              </Button>
              <Button variant="ghost" disabled={busy !== null} onClick={() => void act('remove', () => apiClient.telegram.disconnect(), () => setStatus({ configured: false, botUsername: null, linked: false, linkUrl: null }), "We couldn't disconnect Telegram.")}>
                {busy === 'remove' ? <Spinner aria-hidden="true" /> : <Unlink aria-hidden="true" />}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm text-fg-muted marker:text-fg-subtle">
            <li>
              <div className="flex flex-col gap-2">
              <span>
                In Telegram, message <span className="font-medium text-fg">@BotFather</span>, send <code>/newbot</code> and follow the steps. Paste the token it gives you here. It is stored encrypted.
              </span>
              <form noValidate onSubmit={save} className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <PasswordField label="Bot token" value={token} onChange={(e) => setToken(e.target.value)} error={error} autoComplete="off" placeholder="123456789:AA..." />
                </div>
                <Button type="submit" disabled={busy !== null}>
                  {busy === 'save' ? <Spinner aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                  {status.configured ? 'Replace bot' : 'Save bot'}
                </Button>
              </form>
              </div>
            </li>
            <li className={status.linkUrl ? '' : 'opacity-50'}>
              <div className="flex flex-col gap-2">
              <span>Open your bot and press Start.</span>
              {status.linkUrl ? (
                <Button variant="outline" asChild className="w-fit">
                  <a href={status.linkUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" />
                    Open @{status.botUsername}
                  </a>
                </Button>
              ) : null}
              </div>
            </li>
            <li className={status.linkUrl ? '' : 'opacity-50'}>
              <div className="flex flex-col gap-2">
              <span>Come back and confirm. We will send a hello message.</span>
              <Button className="w-fit" disabled={!status.linkUrl || busy !== null} onClick={() => void act('confirm', () => apiClient.telegram.confirm(), (s) => { setStatus(s); notify.success('Telegram connected.') }, 'We have not seen your Start message yet. Open the bot, press Start, then try again.')}>
                {busy === 'confirm' ? <Spinner aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                I pressed Start
              </Button>
              </div>
            </li>
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
