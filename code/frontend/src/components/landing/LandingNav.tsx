import { ArrowRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/kit/button'
import { Brand } from '@/components/layout/Brand'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'
import { useSession } from '@/lib/auth/client'
import { PAGE_ROUTES } from '@/lib/routes'

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Privacy', href: '#privacy' },
] as const

/** Primary CTA styled link (navigation, so a link, not a button). Shared by the landing sections. */
export const primaryLink =
  'inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg shadow-sm outline-none transition-[background-color,transform,box-shadow] hover:bg-primary-hover hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:scale-[0.98] motion-reduce:transition-none'

export const secondaryLink =
  'inline-flex items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-fg shadow-xs outline-none transition-[background-color,transform] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:transition-none'

const navLink =
  'rounded-full px-3.5 py-1.5 text-sm font-medium text-fg-muted outline-none transition-colors hover:bg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none'

/** Floating pill nav. Condenses on scroll; collapses to a menu on small screens. */
export function LandingNav() {
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const signedIn = Boolean(session?.user)

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <nav
        aria-label="Main"
        className={`mx-auto flex w-full max-w-[86vw] items-center justify-between gap-4 rounded-full border py-2 pr-2 pl-5 transition-[background-color,border-color,box-shadow] duration-300 max-md:max-w-full motion-reduce:transition-none ${
          scrolled || open
            ? 'border-line bg-surface/85 shadow-md backdrop-blur-sm'
            : 'border-transparent bg-transparent'
        }`}
      >
        <Link to={PAGE_ROUTES.home} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Brand />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ label, href }) => (
            <li key={href}>
              <a href={href} className={navLink}>
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>
          {signedIn ? (
            <Link to={PAGE_ROUTES.dashboard.root} className={primaryLink}>
              Open app
              <ArrowRight aria-hidden="true" className="size-[1.1em]" />
            </Link>
          ) : (
            <>
              <Link to={PAGE_ROUTES.auth.signIn} className={`${navLink} hidden sm:inline-flex`}>
                Sign in
              </Link>
              <Link to={PAGE_ROUTES.auth.signUp} className={`${primaryLink} hidden sm:inline-flex`}>
                Get started
                <ArrowRight aria-hidden="true" className="size-[1.1em]" />
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="rounded-full md:hidden"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          className="mx-auto mt-2 flex w-full flex-col gap-1 rounded-3xl border border-line bg-surface p-3 shadow-lg md:hidden"
        >
          {LINKS.map(({ label, href }) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className={`${navLink} py-2.5`}>
              {label}
            </a>
          ))}
          <div className="my-1 border-t border-line" />
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm text-fg-muted">Theme</span>
            <ThemeSwitcher />
          </div>
          {!signedIn && (
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Link to={PAGE_ROUTES.auth.signIn} className={secondaryLink}>
                Sign in
              </Link>
              <Link to={PAGE_ROUTES.auth.signUp} className={primaryLink}>
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
