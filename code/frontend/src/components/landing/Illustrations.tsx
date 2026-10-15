import {
  BellRing,
  Bot,
  CalendarDays,
  Eye,
  Globe,
  KeyRound,
  NotebookPen,
  ShoppingBasket,
  Sparkles,
  User,
} from 'lucide-react'

/*
 * Landing-page illustrations, composed from the same tokens and shapes as the real app so they
 * stay true to the product and re-theme with it. Every value shown is example content, marked
 * aria-hidden: these are pictures, not data.
 */

const card = 'rounded-2xl border border-line bg-raised shadow-lg'

export function NoteVignette({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${card} flex w-full flex-col gap-3 p-5 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-fg-subtle">
        <NotebookPen className="size-[1.1em] text-primary-ink" />
        Note · edited 2 min ago
      </div>
      <p className="text-base font-semibold tracking-tight text-fg">Weekend plan</p>
      <div className="flex flex-col gap-2">
        <span className="h-[0.9vh] w-full rounded-full bg-muted-strong" />
        <span className="h-[0.9vh] w-5/6 rounded-full bg-muted-strong" />
        <span className="h-[0.9vh] w-2/3 rounded-full bg-muted-strong" />
      </div>
    </div>
  )
}

const SPEND = [
  { label: 'Groceries', value: 'KES 12,400', pct: 'w-4/5' },
  { label: 'Transport', value: 'KES 5,150', pct: 'w-2/5' },
  { label: 'Eating out', value: 'KES 3,900', pct: 'w-1/3' },
] as const

export function BudgetVignette({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${card} flex w-full flex-col gap-4 p-5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-fg-subtle">Spent this month</span>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-ink">On track</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-fg tabular-nums">KES 21,450</p>
      <ul className="flex flex-col gap-3">
        {SPEND.map(({ label, value, pct }) => (
          <li key={label} className="flex flex-col gap-1.5">
            <span className="flex justify-between text-xs">
              <span className="text-fg-muted">{label}</span>
              <span className="font-medium text-fg tabular-nums">{value}</span>
            </span>
            <span className="h-[0.8vh] w-full rounded-full bg-muted">
              <span className={`block h-full rounded-full bg-primary ${pct}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ShoppingVignette({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${card} flex w-full items-center gap-3 p-4 ${className}`}>
      <span className="inline-flex items-center justify-center rounded-xl bg-primary-soft p-2.5 text-primary-ink">
        <ShoppingBasket className="size-[1.2em]" />
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-fg">Shopping list</span>
        <span className="text-xs text-fg-subtle">8 items · 3 picked up</span>
      </div>
    </div>
  )
}

export function ReminderVignette({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${card} flex w-full items-center gap-3 p-4 ${className}`}>
      <span className="inline-flex items-center justify-center rounded-xl bg-primary p-2.5 text-primary-fg">
        <BellRing className="size-[1.2em]" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-fg">Dentist in 1 hour</span>
        <span className="text-xs text-fg-subtle">Thursday · 15:30</span>
      </div>
    </div>
  )
}

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const BUSY = new Set([1, 3, 4])

export function CalendarVignette({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${card} flex w-full flex-col gap-4 p-5 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-fg">
        <CalendarDays className="size-[1.1em] text-primary-ink" />
        This week
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEK.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-xs text-fg-subtle">{d}</span>
            <span
              className={`inline-flex size-[4vh] items-center justify-center rounded-lg text-xs font-medium tabular-nums ${
                i === 3 ? 'bg-primary text-primary-fg' : 'bg-muted text-fg'
              }`}
            >
              {12 + i}
            </span>
            <span className={`size-[0.7vh] rounded-full ${BUSY.has(i) ? 'bg-primary' : 'bg-transparent'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

const ENTRIES = [
  { icon: Globe, site: 'github.com', user: 'matthew' },
  { icon: User, site: 'bank portal', user: 'm.kabiu' },
] as const

export function VaultVignette({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${card} flex w-full flex-col p-2 ${className}`}>
      {ENTRIES.map(({ icon: Icon, site, user }) => (
        <div key={site} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <span className="inline-flex items-center justify-center rounded-lg border border-line bg-muted p-2 text-fg-muted">
            <Icon className="size-[1.05em]" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-fg">{site}</span>
            <span className="truncate text-xs text-fg-subtle">{user}</span>
          </div>
          <span className="font-mono text-sm tracking-widest text-fg-subtle">••••••</span>
          <Eye className="size-[1.05em] text-fg-subtle" />
        </div>
      ))}
      <div className="mx-3 mt-1 mb-2 flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-xs font-medium text-primary-ink">
        <KeyRound className="size-[1.05em]" />
        Encrypted on this device
      </div>
    </div>
  )
}

export function AssistantVignette({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`${card} flex w-full flex-col gap-3 p-4 ${className}`}>
      <div className="ml-auto w-4/5 rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-fg">
        What's still open for this week?
      </div>
      <div className="flex items-start gap-2.5">
        <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft p-1.5 text-primary-ink">
          <Bot className="size-[1.05em]" />
        </span>
        <div className="flex w-4/5 flex-col gap-1.5 rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm text-fg">
          <span>Two to-dos left:</span>
          <span className="text-fg-muted">Buy eggs, milk and bread. Book the dentist.</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 self-start rounded-full border border-line px-2.5 py-1 text-xs text-fg-subtle">
        <Sparkles className="size-[1em] text-primary-ink" />
        Using your own API key
      </div>
    </div>
  )
}
