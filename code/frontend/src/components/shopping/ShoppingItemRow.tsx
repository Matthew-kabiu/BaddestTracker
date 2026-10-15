import { Check, Pencil, Trash2, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/kit/button'
import { Checkbox } from '@/components/kit/checkbox'
import { Input } from '@/components/kit/input'
import { Spinner } from '@/components/kit/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/kit/tooltip'
import { formatDay, localToday } from '@/lib/format/dates'
import { parseMoney } from '@/lib/format/money'
import { useMoney } from '@/hooks/use-money'
import type { ShoppingItem, UpdateShoppingItemDTO } from '@/types/api'

export const ITEM_NAME_MAX = 200
export const QUANTITY_MAX = 10_000

interface ShoppingItemRowProps {
  item: ShoppingItem
  onUpdate: (id: string, dto: UpdateShoppingItemDTO) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
}

/** One item: tick to mark bought today, inline edit of name / quantity / price, delete. */
export function ShoppingItemRow({ item, onUpdate, onRemove }: ShoppingItemRowProps) {
  const formatMoney = useMoney()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [price, setPrice] = useState(item.unitPriceCents === null ? '' : (item.unitPriceCents / 100).toFixed(2))
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const bought = item.boughtOn !== null
  const total = item.unitPriceCents === null ? null : item.unitPriceCents * item.quantity

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    const qty = Number(quantity)
    const cents = price.trim() === '' ? null : parseMoney(price)
    if (!trimmed || trimmed.length > ITEM_NAME_MAX) return setError('Give the item a name (up to 200 characters)')
    if (!Number.isInteger(qty) || qty < 1 || qty > QUANTITY_MAX) return setError('Quantity must be a whole number from 1')
    if (price.trim() !== '' && cents === null) return setError('Price must be an amount like 2.50')
    setSaving(true)
    const ok = await onUpdate(item.id, { name: trimmed, quantity: qty, unitPriceCents: cents })
    setSaving(false)
    if (ok) {
      setError(undefined)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <li className="px-5 py-3">
        <form onSubmit={save} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Item name" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1" autoFocus />
            <Input aria-label="Quantity" type="number" min={1} max={QUANTITY_MAX} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-1/6 min-w-[10vh]" />
            <Input aria-label="Price each" inputMode="decimal" placeholder="Price each" value={price} onChange={(e) => setPrice(e.target.value)} className="w-1/5 min-w-[12vh]" />
            <Button type="submit" size="icon" variant="ghost" aria-label="Save item" disabled={saving}>
              {saving ? <Spinner aria-hidden="true" /> : <Check aria-hidden="true" />}
            </Button>
            <Button size="icon" variant="ghost" aria-label="Cancel edit" onClick={() => setEditing(false)}>
              <X aria-hidden="true" />
            </Button>
          </div>
          {error && <p className="text-xs text-danger-ink">{error}</p>}
        </form>
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-muted/60 motion-reduce:transition-none">
      <Checkbox
        checked={bought}
        onCheckedChange={() => void onUpdate(item.id, { boughtOn: bought ? null : localToday() })}
        aria-label={bought ? `Move "${item.name}" back to the list` : `Mark "${item.name}" as bought`}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-sm break-words ${bought ? 'text-fg-subtle line-through' : 'text-fg'}`}>
          {item.name}
          {item.quantity > 1 && <span className="text-fg-muted"> × {item.quantity}</span>}
        </span>
        {bought && item.boughtOn && <span className="text-xs text-fg-subtle">Bought {formatDay(item.boughtOn)}</span>}
      </span>
      <span className="shrink-0 text-sm text-fg-muted tabular-nums">
        {total === null ? <span className="text-fg-subtle">No price</span> : formatMoney(total)}
      </span>
      <span className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Delete" className="hover:text-danger-ink" onClick={() => void onRemove(item.id)}>
              <Trash2 aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </span>
    </li>
  )
}
