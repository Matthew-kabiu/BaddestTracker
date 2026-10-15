import { ArrowLeft, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Suspense } from 'react'
import { Link, Outlet } from 'react-router'

import { LoadingState } from '@/components/feedback/LoadingState'
import { AssistantVignette } from '@/components/landing/Illustrations'
import { TodoDemo } from '@/components/landing/TodoDemo'
import { Brand } from '@/components/layout/Brand'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { PAGE_ROUTES } from '@/lib/routes'

const POINTS = [
  { icon: Lock, text: 'Passwords are encrypted on your device.' },
  { icon: Sparkles, text: 'The assistant runs on your own AI key.' },
  { icon: ShieldCheck, text: 'Only you can see your lists and notes.' },
] as const

/** Split-screen auth shell: short brand panel on the left (large screens), form on the right. */
export function PublicLayout() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="grid min-h-dvh w-full bg-canvas text-fg lg:grid-cols-[5fr_7fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface p-12 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(var(--color-line-strong)_0.08vw,transparent_0.09vw)] bg-size-[2.2vw_2.2vw] opacity-60 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_60%,black,transparent)]" />
          <div className="absolute -bottom-[25vh] -left-[10vw] size-[45vw] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <Link to={PAGE_ROUTES.home} className="relative w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Brand />
        </Link>
        <div className="relative flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <h2 className="w-11/12 text-3xl leading-tight font-semibold tracking-tight text-balance">
              Everything you keep track of, <span className="text-primary-ink">in one private place.</span>
            </h2>
            <ul className="flex flex-col gap-3">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-fg-muted">
                  <span className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary-soft p-1.5 text-primary-ink">
                    <Icon aria-hidden="true" className="size-[1em]" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative pb-[12vh]">
            <div className="relative z-10 w-4/5">
              <TodoDemo />
            </div>
            <div className="absolute right-0 bottom-0 z-20 w-3/5 rotate-2">
              <AssistantVignette />
            </div>
          </div>
        </div>
        <p className="relative text-xs text-fg-subtle">Private by design. Your data, your keys.</p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-6">
          <Link
            to={PAGE_ROUTES.home}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-fg-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <ArrowLeft aria-hidden="true" className="size-[1.05em]" />
            Home
          </Link>
          <ThemeSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: '1.5vh' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="flex w-11/12 flex-col gap-8 sm:w-3/5 lg:w-3/5 xl:w-1/2"
          >
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="rounded-3xl border border-line bg-surface p-8 shadow-md sm:p-10">
              <Suspense fallback={<LoadingState />}>
                <Outlet />
              </Suspense>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
