import { Plus, RotateCcw, ShoppingBag, ShoppingCart, Wallet } from 'lucide-react'
import { DashboardMetric } from '@/components/layout/DashboardMetric'
import { type FormEvent, useState } from 'react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { Button } from '@/components/kit/button'
import { Card, CardContent } from '@/components/kit/card'
import { Input } from '@/components/kit/input'
import { Spinner } from '@/components/kit/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/kit/tabs'
import { ITEM_NAME_MAX, QUANTITY_MAX, ShoppingItemRow } from '@/components/shopping/ShoppingItemRow'
import { Page } from '@/components/layout/Page'
import { useShopping } from '@/hooks/use-shopping'
import { localToday, monthRange } from '@/lib/format/dates'
import { parseMoney } from '@/lib/format/money'
import { useMoney } from '@/hooks/use-money'

type View = 'toBuy' | 'bought'

export default function ShoppingPage() {
  const formatMoney = useMoney()
  const { items, status, reload, create, update, remove } = useShopping()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string>()
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<View>('toBuy')

  const toBuy = items.filter((i) => i.boughtOn === null)
  const bought = items.filter((i) => i.boughtOn !== null)
  const estimate = toBuy.reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * i.quantity, 0)
  const { from, to } = monthRange(localToday())
  const spentThisMonth = bought
    .filter((i) => i.boughtOn! >= from && i.boughtOn! <= to)
    .reduce((sum, i) => sum + (i.unitPriceCents ?? 0) * i.quantity, 0)
  const visible = view === 'toBuy' ? toBuy : bought

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    const qty = Number(quantity)
    const cents = price.trim() === '' ? null : parseMoney(price)
    if (!trimmed) return setError('What do you need to buy?')
    if (trimmed.length > ITEM_NAME_MAX) return setError(`Keep it under ${ITEM_NAME_MAX} characters`)
    if (!Number.isInteger(qty) || qty < 1 || qty > QUANTITY_MAX) return setError('Quantity must be a whole number from 1')
    if (price.trim() !== '' && cents === null) return setError('Price must be an amount like 2.50')
    setAdding(true)
    const ok = await create({ name: trimmed, quantity: qty, unitPriceCents: cents })
    setAdding(false)
    if (ok) {
      setName('')
      setQuantity('1')
      setPrice('')
      setView('toBuy')
    }
  }

  return (
    <Page title="Shopping list" description={status !== 'ready'
              ? 'What you need from the shops.'
              : toBuy.length === 0
                ? 'Nothing to buy right now.'
                : `${toBuy.length} to buy${estimate ? `, about ${formatMoney(estimate)}` : ''}`} actions={<>{status === 'ready' && spentThisMonth > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-xs text-fg-subtle">Bought this month</span>
            <span className="text-lg font-semibold tabular-nums">{formatMoney(spentThisMonth)}</span>
          </div>
        )}</>}>
      <section aria-label="Shopping summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardMetric label="On your list" value={status === 'ready' ? toBuy.length : '-'} detail="Items left to pick up" icon={ShoppingCart} accent />
        <DashboardMetric label="Estimated total" value={status === 'ready' ? formatMoney(estimate) : '-'} detail="For items with a saved price" icon={Wallet} />
        <DashboardMetric label="Bought this month" value={status === 'ready' ? formatMoney(spentThisMonth) : '-'} detail="From your shopping purchases" icon={ShoppingBag} />
      </section>
      <Card className="gap-0 overflow-hidden py-0">
        <form noValidate onSubmit={handleAdd} className="flex flex-col gap-3 border-b bg-muted/30 p-5">
          <h2 className="text-sm font-medium">Add to your next trip</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Item"
              placeholder="Add an item"
              value={name}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'new-item-error' : undefined}
              onChange={(e) => {
                setName(e.target.value)
                setError(undefined)
              }}
              className="min-w-0 flex-1 basis-1/2"
            />
            <Input
              aria-label="Quantity"
              type="number"
              min={1}
              max={QUANTITY_MAX}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-1/6 min-w-[10vh]"
            />
            <Input
              aria-label="Price each (optional)"
              inputMode="decimal"
              placeholder="Price each"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-1/5 min-w-[12vh]"
            />
            <Button type="submit" disabled={adding} className="shrink-0">
              {adding ? <Spinner aria-hidden="true" /> : <Plus aria-hidden="true" />}
              Add
            </Button>
          </div>
          {error && (
            <p id="new-item-error" className="px-1 text-xs text-danger-ink">
              {error}
            </p>
          )}
        </form>

        {status === 'ready' && items.length > 0 && (
          <div className="border-b px-5 py-3">
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList aria-label="Shopping list view" variant="line">
                <TabsTrigger value="toBuy">
                  To buy <span className="text-xs text-fg-subtle tabular-nums">{toBuy.length}</span>
                </TabsTrigger>
                <TabsTrigger value="bought">
                  Bought <span className="text-xs text-fg-subtle tabular-nums">{bought.length}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        <CardContent className="px-0">
          {status === 'loading' && <LoadingState label="Loading your list…" />}
          {status === 'error' && (
            <EmptyState
              icon={ShoppingCart}
              title="We couldn't load your list"
              description="Check your connection and try again."
              action={
                <Button variant="outline" onClick={reload}>
                  <RotateCcw aria-hidden="true" />
                  Try again
                </Button>
              }
            />
          )}
          {status === 'ready' && items.length === 0 && (
            <EmptyState
              icon={ShoppingCart}
              title="Your list is empty"
              description="Add what you need. Prices you enter count towards a shopping budget."
            />
          )}
          {status === 'ready' && items.length > 0 && visible.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-fg-muted">
              {view === 'toBuy' ? 'Everything is bought. Nice.' : 'Nothing bought yet.'}
            </p>
          )}
          {visible.length > 0 && (
            <ul className="divide-y">
              {visible.map((item) => (
                <ShoppingItemRow key={`${item.id}-${item.updatedAt}`} item={item} onUpdate={update} onRemove={remove} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </Page>
  )
}
