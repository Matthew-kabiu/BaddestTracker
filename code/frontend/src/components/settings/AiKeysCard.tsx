import { CheckCircle2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { LoadingState } from '@/components/feedback/LoadingState'
import { notify } from '@/components/feedback/toast'
import { PasswordField } from '@/components/forms/PasswordField'
import { TextField } from '@/components/forms/TextField'
import { Badge } from '@/components/kit/badge'
import { Button } from '@/components/kit/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/kit/card'
import { Spinner } from '@/components/kit/spinner'
import { apiClient } from '@/lib/api/apiClient'
import type { AiKeySummary, AiProvider } from '@/types/api'

const PROVIDERS: { id: AiProvider; name: string; modelHint: string }[] = [
  { id: 'anthropic', name: 'Anthropic', modelHint: 'claude-sonnet-5-5' },
  { id: 'openai', name: 'OpenAI', modelHint: 'Model ID from your OpenAI account' },
  { id: 'gemini', name: 'Google Gemini', modelHint: 'Model ID from Google AI Studio' },
  { id: 'openrouter', name: 'OpenRouter', modelHint: 'anthropic/claude-sonnet-5-5' },
]

// Mirrors PutKeyRequest in code/backend/src/ai/handler.rs.
const KEY_MIN = 8
const KEY_MAX = 512
const MODEL_MAX = 200

/** Bring your own key: the assistant uses the user's provider accounts. Keys are stored encrypted. */
export function AiKeysCard() {
  const [keys, setKeys] = useState<AiKeySummary[] | null>(null)
  const [editing, setEditing] = useState<AiProvider | null>(null)
  const [removing, setRemoving] = useState<AiProvider | null>(null)

  useEffect(() => {
    apiClient.ai.listKeys().then(setKeys, (err: unknown) => notify.error(err, "We couldn't load your AI keys."))
  }, [])

  function saved(summary: AiKeySummary) {
    setKeys((prev) => [...(prev ?? []).filter((k) => k.provider !== summary.provider), summary])
    setEditing(null)
  }

  async function remove(provider: AiProvider) {
    try {
      await apiClient.ai.removeKey(provider)
      setKeys((prev) => (prev ?? []).filter((k) => k.provider !== provider))
      setRemoving(null)
    } catch (err) {
      notify.error(err, "We couldn't remove that key.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI providers</CardTitle>
        <CardDescription>
          Add your own API key to use the assistant. Usage is billed to your provider account. Keys are stored encrypted and never shown again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {keys === null ? (
          <LoadingState label="Loading…" />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {PROVIDERS.map((p) => {
              const key = keys.find((k) => k.provider === p.id)
              return (
                <li key={p.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {p.name}
                        {key && (
                          <Badge variant="secondary">
                            <CheckCircle2 aria-hidden="true" />
                            Connected
                          </Badge>
                        )}
                      </span>
                      <span className="truncate text-xs text-fg-subtle">{key ? `Model: ${key.model}` : 'Not set up'}</span>
                    </div>
                    {editing !== p.id && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(p.id)}>
                          {key ? <RefreshCw aria-hidden="true" /> : <Plus aria-hidden="true" />}
                          {key ? 'Change' : 'Add key'}
                        </Button>
                        {key && (
                          <Button variant="ghost" size="sm" onClick={() => setRemoving(p.id)} aria-label={`Remove ${p.name} key`}>
                            <Trash2 aria-hidden="true" />
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {editing === p.id && (
                    <KeyForm provider={p} currentModel={key?.model} onSaved={saved} onCancel={() => setEditing(null)} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={removing !== null}
        title="Remove this key?"
        description="The assistant stops using this provider until you add a key again."
        confirmLabel="Remove"
        onConfirm={() => (removing ? remove(removing) : undefined)}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  )
}

interface KeyFormProps {
  provider: (typeof PROVIDERS)[number]
  currentModel: string | undefined
  onSaved: (summary: AiKeySummary) => void
  onCancel: () => void
}

function KeyForm({ provider, currentModel, onSaved, onCancel }: KeyFormProps) {
  const [errors, setErrors] = useState<{ apiKey?: string; model?: string }>({})
  const [saving, setSaving] = useState(false)

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const apiKey = String(form.get('apiKey') ?? '').trim()
    const model = String(form.get('model') ?? '').trim()
    const next = {
      apiKey: apiKey.length < KEY_MIN ? 'Paste the full API key' : apiKey.length > KEY_MAX ? 'That key is too long' : undefined,
      model: !model ? 'Enter the model to use' : model.length > MODEL_MAX ? 'That model name is too long' : undefined,
    }
    setErrors(next)
    if (next.apiKey || next.model) return
    setSaving(true)
    try {
      onSaved(await apiClient.ai.putKey(provider.id, { apiKey, model }))
      notify.success(`${provider.name} key saved.`)
    } catch (err) {
      notify.error(err, `We couldn't save the ${provider.name} key.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={save} className="grid items-start gap-3 md:grid-cols-[2fr_1fr_auto]">
      <PasswordField label={`${provider.name} API key`} name="apiKey" autoComplete="off" error={errors.apiKey} autoFocus />
      <TextField label="Model" name="model" defaultValue={currentModel} placeholder={provider.modelHint} error={errors.model} autoComplete="off" />
      <div className="flex gap-2 md:pt-6">
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
