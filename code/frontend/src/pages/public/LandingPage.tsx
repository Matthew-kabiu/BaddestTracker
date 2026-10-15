import {
  ArrowRight,
  CalendarDays,
  Check,
  KeyRound,
  ListTodo,
  Lock,
  MessageSquareText,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Wallet,
  Zap,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import {
  AssistantVignette,
  BudgetVignette,
  CalendarVignette,
  NoteVignette,
  ReminderVignette,
  ShoppingVignette,
  VaultVignette,
} from '@/components/landing/Illustrations'
import { LandingNav, primaryLink, secondaryLink } from '@/components/landing/LandingNav'
import { TodoDemo } from '@/components/landing/TodoDemo'
import { Brand } from '@/components/layout/Brand'
import { PAGE_ROUTES } from '@/lib/routes'

const container = 'mx-auto w-11/12 max-w-[84vw] max-md:max-w-full'

/** Subtle dot-grid texture + emerald wash. Decorative only. */
function Backdrop({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(var(--color-line-strong)_0.08vw,transparent_0.09vw)] bg-size-[2.4vw_2.4vw] opacity-70 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]" />
      <div className="absolute -top-[30vh] left-1/2 size-[70vw] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
    </div>
  )
}

function SectionHeading({ title, text, center = false }: { title: string; text: string; center?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 ${center ? 'items-center text-center md:mx-auto md:w-3/5' : 'md:w-3/5'}`}>
      <h2 className="text-3xl font-semibold tracking-tight text-balance">{title}</h2>
      <p className="text-base leading-relaxed text-fg-muted">{text}</p>
    </div>
  )
}

const BENEFITS = [
  { icon: Zap, title: 'Fast capture', text: 'Add anything in a second.' },
  { icon: Lock, title: 'Private vault', text: 'Encrypted before upload.' },
  { icon: Sparkles, title: 'Your own AI', text: 'Bring any provider key.' },
  { icon: ShieldCheck, title: 'Yours only', text: 'Every record is private to you.' },
] as const

const FEATURE_ROWS: {
  icon: typeof ListTodo
  title: string
  text: string
  points: string[]
  art: ReactNode
}[] = [
  {
    icon: NotebookPen,
    title: 'Lists and notes that keep up with you.',
    text: 'Jot the task, then the thought behind it. Tick things off and watch the week clear.',
    points: ['Inline editing, no extra screens', 'Notes with full-text bodies', 'Open first, done last'],
    art: (
      <div className="relative flex w-full flex-col gap-4">
        <NoteVignette className="w-11/12 -rotate-1" />
        <ReminderVignette className="ml-auto w-3/4 rotate-1" />
      </div>
    ),
  },
  {
    icon: Wallet,
    title: 'Know where the money went.',
    text: 'Plan the shop, log what you spent and see each category at a glance.',
    points: ['Shopping lists you can tick off', 'Monthly spending by category', 'Amounts stored exactly, never rounded'],
    art: (
      <div className="relative flex w-full flex-col gap-4">
        <BudgetVignette className="w-11/12 rotate-1" />
        <ShoppingVignette className="ml-auto w-3/4 -rotate-1" />
      </div>
    ),
  },
]

const STEPS = [
  { icon: UserPlus, title: 'Create your account', text: 'Email and password. Under a minute.' },
  { icon: ListTodo, title: 'Add what is on your mind', text: 'To-dos, notes, budgets and dates, all in one place.' },
  { icon: MessageSquareText, title: 'Ask the assistant', text: 'Connect your own AI key and ask about any of it.' },
] as const

const PRIVACY = [
  {
    icon: Lock,
    title: 'End-to-end encrypted vault',
    text: 'Your master password never leaves your device. The server only stores scrambled data.',
  },
  {
    icon: KeyRound,
    title: 'Your AI key, your account',
    text: 'Anthropic, OpenAI, OpenRouter or Gemini. Encrypted at rest and never shown again.',
  },
  {
    icon: ShieldCheck,
    title: 'The assistant cannot see passwords',
    text: 'It works through the same checks as the app and has no access to the vault.',
  },
] as const

export default function LandingPage() {
  const reduceMotion = useReducedMotion()
  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: '2vh' },
          animate: { opacity: 1, y: 0 },
          transition: { type: 'spring' as const, stiffness: 200, damping: 26, delay },
        }
  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: '3vh' },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-10%' },
        transition: { type: 'spring' as const, stiffness: 160, damping: 24 },
      }

  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <LandingNav />

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative -mt-[9vh] pt-[9vh]">
          <Backdrop />
          <div className={`${container} relative grid items-center gap-14 py-16 lg:grid-cols-[1fr_1.05fr] lg:pt-20 lg:pb-36`}>
            <div className="flex flex-col items-start gap-7">
              <motion.span
                {...rise(0)}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-muted shadow-xs"
              >
                <ShieldCheck aria-hidden="true" className="size-[1.1em] text-primary-ink" />
                Private by design
              </motion.span>
              <motion.h1 {...rise(0.05)} className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance md:text-[3.4vw]">
                Everything you keep track of,{' '}
                <span className="text-primary-ink">in one private place.</span>
              </motion.h1>
              <motion.p {...rise(0.1)} className="text-lg leading-relaxed text-fg-muted lg:w-11/12">
                To-dos, notes, money, dates and passwords together, with an assistant that answers questions about all of it.
              </motion.p>
              <motion.div {...rise(0.15)} className="flex flex-wrap items-center gap-3">
                <Link to={PAGE_ROUTES.auth.signUp} className={primaryLink}>
                  Get started
                  <ArrowRight aria-hidden="true" className="size-[1.1em]" />
                </Link>
                <a href="#features" className={secondaryLink}>
                  See what's inside
                </a>
              </motion.div>
            </div>

            {/* Collage: live demo in front, illustration cards floating behind. */}
            <motion.div {...rise(0.2)} className="relative mx-auto w-full max-w-[38vw] max-lg:max-w-full">
              {/* Reminder peeks from the top-left; assistant overlaps the bottom-right, above the demo. */}
              <div className="absolute -top-[2vh] -left-[2vw] z-0 hidden w-1/2 -rotate-3 lg:block">
                <ReminderVignette />
              </div>
              <div className="relative z-10 lg:mt-[9vh] lg:mr-[6vw]">
                <TodoDemo />
              </div>
              <div className="relative z-20 mt-4 w-full lg:absolute lg:-right-[1vw] lg:-bottom-[16vh] lg:mt-0 lg:w-3/5 lg:rotate-2">
                <AssistantVignette />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Benefits strip ──────────────────────────────── */}
        <section aria-label="Highlights" className="border-y border-line bg-surface">
          <ul className={`${container} grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-4`}>
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary-soft p-2.5 text-primary-ink">
                  <Icon aria-hidden="true" className="size-[1.2em]" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-fg">{title}</span>
                  <span className="text-sm text-fg-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Feature rows (2 alternating, then a bento) ───── */}
        <section id="features" className="scroll-mt-[12vh] py-24">
          <div className={`${container} flex flex-col gap-24`}>
            <SectionHeading
              center
              title="Five tools that usually live in five apps."
              text="One account and one place to look. Each part works on its own and gets better with the others."
            />

            {FEATURE_ROWS.map(({ icon: Icon, title, text, points, art }, i) => (
              <motion.div
                key={title}
                {...reveal}
                className="grid items-center gap-12 md:grid-cols-2 md:gap-16"
              >
                <div className={`flex flex-col gap-5 ${i % 2 ? 'md:order-2' : ''}`}>
                  <span className="inline-flex w-fit items-center justify-center rounded-xl border border-line bg-surface p-2.5 text-primary-ink shadow-xs">
                    <Icon aria-hidden="true" className="size-[1.3em]" />
                  </span>
                  <h3 className="text-2xl font-semibold tracking-tight text-balance">{title}</h3>
                  <p className="text-base leading-relaxed text-fg-muted">{text}</p>
                  <ul className="flex flex-col gap-2.5">
                    {points.map((p) => (
                      <li key={p} className="flex items-center gap-2.5 text-sm text-fg">
                        <span className="inline-flex items-center justify-center rounded-full bg-primary-soft p-0.5 text-primary-ink">
                          <Check aria-hidden="true" className="size-[0.9em]" strokeWidth={3} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative rounded-3xl border border-line bg-muted/60 p-[3vw] max-md:p-6">
                  {art}
                </div>
              </motion.div>
            ))}

            {/* Bento: 3 cells, asymmetric (wide calendar, then vault + assistant). */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <motion.article
                {...reveal}
                className="flex flex-col justify-between gap-8 overflow-hidden rounded-3xl border border-line bg-surface p-8 md:col-span-3"
              >
                <div className="flex flex-col gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink">
                    <CalendarDays aria-hidden="true" className="size-[1.1em]" />
                    Calendar and reminders
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">Dates you set, nudges before they matter.</h3>
                </div>
                <CalendarVignette className="shadow-md" />
              </motion.article>
              <motion.article
                {...reveal}
                className="relative flex flex-col justify-between gap-8 overflow-hidden rounded-3xl border border-line bg-primary-soft p-8 md:col-span-2"
              >
                <div className="flex flex-col gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink">
                    <KeyRound aria-hidden="true" className="size-[1.1em]" />
                    Password vault
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">Locked on your device. We cannot read it.</h3>
                </div>
                <VaultVignette className="shadow-md" />
              </motion.article>
              <motion.article
                {...reveal}
                className="grid items-center gap-8 overflow-hidden rounded-3xl border border-line bg-surface p-8 md:col-span-5 md:grid-cols-2"
              >
                <div className="flex flex-col gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink">
                    <Sparkles aria-hidden="true" className="size-[1.1em]" />
                    Assistant
                  </span>
                  <h3 className="text-2xl font-semibold tracking-tight text-balance">
                    Ask in plain words. Get answers from your own data.
                  </h3>
                  <p className="text-base leading-relaxed text-fg-muted">
                    "What did I spend on food?" or "Add milk to my list." It can read and update your to-dos and notes,
                    and nothing else.
                  </p>
                </div>
                <AssistantVignette className="shadow-md" />
              </motion.article>
            </div>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────── */}
        <section id="how" className="scroll-mt-[12vh] border-t border-line bg-surface py-24">
          <div className={`${container} flex flex-col gap-14`}>
            <SectionHeading center title="Up and running in a minute." text="No setup guides, no imports. Start with one list." />
            <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
              <span aria-hidden="true" className="absolute top-[3.2vh] right-[16%] left-[16%] hidden border-t border-dashed border-line-strong md:block" />
              {STEPS.map(({ icon: Icon, title, text }) => (
                <motion.li key={title} {...reveal} className="relative flex flex-col items-center gap-4 text-center">
                  <span className="inline-flex items-center justify-center rounded-2xl border border-line bg-canvas p-4 text-primary-ink shadow-sm">
                    <Icon aria-hidden="true" className="size-[1.5em]" />
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm text-fg-muted md:w-4/5">{text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Privacy ────────────────────────────────────── */}
        <section id="privacy" className="scroll-mt-[12vh] py-24">
          <div className={`${container} grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center`}>
            <div className="flex flex-col gap-5">
              <span className="inline-flex w-fit items-center justify-center rounded-2xl bg-primary p-4 text-primary-fg shadow-md">
                <ShieldCheck aria-hidden="true" className="size-[1.8em]" />
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">Built so your data stays yours.</h2>
              <p className="text-base leading-relaxed text-fg-muted">
                Private by default, not by setting. Here is exactly what that means for you.
              </p>
            </div>
            <dl className="flex flex-col gap-4">
              {PRIVACY.map(({ icon: Icon, title, text }) => (
                <motion.div
                  key={title}
                  {...reveal}
                  className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs"
                >
                  <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary-soft p-2.5 text-primary-ink">
                    <Icon aria-hidden="true" className="size-[1.2em]" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <dt className="text-base font-semibold">{title}</dt>
                    <dd className="text-sm leading-relaxed text-fg-muted">{text}</dd>
                  </div>
                </motion.div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────── */}
        <section className="pb-24">
          <div className={container}>
            <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-fg shadow-lg md:px-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(color-mix(in_oklab,var(--color-primary-fg)_25%,transparent)_0.08vw,transparent_0.09vw)] bg-size-[2vw_2vw] opacity-40"
              />
              <div className="relative flex flex-col items-center gap-6">
                <h2 className="text-3xl font-semibold tracking-tight text-balance">Start with your next to-do.</h2>
                <p className="text-base opacity-90">Free to set up. Takes under a minute.</p>
                <Link
                  to={PAGE_ROUTES.auth.signUp}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-fg px-6 py-3 text-sm font-semibold text-primary outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-primary-fg focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:scale-[0.98] motion-reduce:transition-none"
                >
                  Get started
                  <ArrowRight aria-hidden="true" className="size-[1.1em]" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className={`${container} grid gap-10 py-14 md:grid-cols-4`}>
          <div className="flex flex-col gap-3 md:col-span-2">
            <Brand />
            <p className="text-sm text-fg-muted md:w-3/4">
              To-dos, notes, money, dates and passwords in one private place.
            </p>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2.5 text-sm">
            <span className="font-semibold text-fg">Product</span>
            <a href="#features" className="text-fg-muted hover:text-fg">Features</a>
            <a href="#how" className="text-fg-muted hover:text-fg">How it works</a>
            <a href="#privacy" className="text-fg-muted hover:text-fg">Privacy</a>
          </nav>
          <nav aria-label="Account" className="flex flex-col gap-2.5 text-sm">
            <span className="font-semibold text-fg">Account</span>
            <Link to={PAGE_ROUTES.auth.signIn} className="text-fg-muted hover:text-fg">Sign in</Link>
            <Link to={PAGE_ROUTES.auth.signUp} className="text-fg-muted hover:text-fg">Create account</Link>
          </nav>
        </div>
        <div className="border-t border-line">
          <p className={`${container} py-6 text-xs text-fg-subtle`}>Private by design. Your data, your keys.</p>
        </div>
      </footer>
    </div>
  )
}
