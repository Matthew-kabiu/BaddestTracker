import { Plus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type FormEvent, useId, useState } from 'react'

import { Button } from '@/components/kit/button'
import { Checkbox } from '@/components/kit/checkbox'
import { Input } from '@/components/kit/input'

interface DemoItem {
  id: number
  title: string
  done: boolean
}

/** Example items shown to visitors. Local state only; nothing is saved or sent anywhere. */
const SEED: DemoItem[] = [
  { id: 1, title: 'Pay electricity bill', done: true },
  { id: 2, title: 'Buy eggs, milk and bread', done: false },
  { id: 3, title: "Book dentist for Thursday", done: false },
]

/**
 * A real, working mini to-do list in the hero (not a picture of one).
 * Visitors can add and tick items; state lives in this component and is lost on reload.
 */
export function TodoDemo() {
  const reduceMotion = useReducedMotion()
  const inputId = useId()
  const [items, setItems] = useState(SEED)
  const [draft, setDraft] = useState('')
  const left = items.filter((i) => !i.done).length

  function add(e: FormEvent) {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setItems((prev) => [{ id: Date.now(), title, done: false }, ...prev].slice(0, 6))
    setDraft('')
  }

  function toggle(id: number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  }

  return (
    <section
      aria-label="Try the to-do list"
      className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
    >
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-fg">Today</span>
          <span className="text-xs text-fg-subtle" aria-live="polite">
            {left === 0 ? 'All done' : `${left} of ${items.length} left`}
          </span>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-ink">Try it</span>
      </header>

      <form onSubmit={add} className="flex items-center gap-2 border-b border-line px-5 py-3">
        <label htmlFor={inputId} className="sr-only">
          New to-do
        </label>
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={80}
          placeholder="Add a to-do and press Enter"
          className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon-sm" aria-label="Add to-do">
          <Plus aria-hidden="true" />
        </Button>
      </form>

      <ul className="flex flex-col py-1.5">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: '-0.8vh' }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            >
              <label className="flex w-full cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted motion-reduce:transition-none">
                <Checkbox checked={item.done} onCheckedChange={() => toggle(item.id)} />
                <span className={`truncate text-sm ${item.done ? 'text-fg-subtle line-through' : 'text-fg'}`}>
                  {item.title}
                </span>
              </label>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  )
}
