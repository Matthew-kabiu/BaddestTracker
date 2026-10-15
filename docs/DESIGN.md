# Design System: Baddest Tracker

Status: **Mandatory** · Owner: Matt · Last updated: 2026-10-12
Applies to: `code/frontend` (web app + landing page) and the browser extension UI.

Every agent and contributor touching UI must follow this file. Where it conflicts with
`docs/Vite-Build-Template.md` or `docs/Frontend-UI-Motion-Tooling-Standard.md` on
**styling, sizing, colour, type, charts, or layout**, this file wins. Those documents still
govern routes, the API client, error handling, toasts, tooltips, motion and security.

Design read: *a calm, Linear-style personal productivity product. One restrained accent,
generous whitespace, real UI as the visual language.*

---

## 1. Tailwind only, no custom CSS

- All styling is Tailwind utility classes in `className`.
- The **only** CSS file is `src/index.css`. It may contain only `@import "tailwindcss";`, one
  `@theme static { ... }` block of design tokens, and directives Tailwind or the kit requires
  (today: one `@layer base` rule giving `border` the border token, which shadcn's init adds too).
- ❌ No other stylesheets, CSS modules, `<style>` tags, `style={{ }}` props, CSS-in-JS, or
  `@apply`. Do not route around this with `ref.style` either. If a utility is missing, add a
  token to `@theme`.
- ❌ No `@custom-variant` without testing it compiles. An invalid rule silently drops every token
  after it (this happened once: the whole palette vanished).
- **No hand-built UI components.** Every control comes from the kit in
  `docs/Frontend-UI-Motion-Tooling-Standard.md`: shadcn/ui, the `@kokonutui` free registry and the
  `@bklit` registry, installed with `pnpm dlx shadcn@latest add <name>` (config: `components.json`).
  shadcn/Kokonut parts land in `src/components/kit/`, BkLit charts in `src/components/charts/`.
- App-level pieces (forms, ThemeSwitcher, ConfirmDialog, LoadingState, EmptyState) are thin
  compositions **of kit parts only**, never new primitives.
- On install, adapt only what breaks our system: remove `dark:` classes (Tailwind's `dark:`
  follows the OS, not our theme switch; our `light-dark()` tokens already theme the kit), replace
  raw palette colours (`text-white`, `bg-black/50`) with tokens, and replace `next-themes` with
  `useTheme()`. Never run `shadcn init`: it rewrites `index.css`. If the CLI appends CSS
  (`:root`, `.dark`, `@theme inline`, `@custom-variant`), move what is needed into our `@theme`
  as `light-dark()` tokens and delete the rest.
- **Vendored exemption:** files in `components/kit/` and `components/charts/` keep their upstream
  internals (inline `style`, `px`, `rem`). The scans in section 11 exclude those folders; every file
  we write passes them.

## 2. No fixed measurements: dynamic units only

**We never write `px` or `rem`.** Every size scales with the viewport or its container.

| Use | For |
|---|---|
| `%` / fractions: `w-full`, `w-1/2`, `basis-1/3` | widths relative to the parent |
| `dvh` / `vh`: `h-dvh`, `min-h-dvh` | full-height layouts, scroll regions |
| `vw` / `vmin` | widths and offsets relative to the screen |
| `fr`, `grid-cols-*`, `grid-cols-[5fr_7fr]` | grid tracks |
| `cqw` / `cqh` with `@container` | components that size to their slot (cards, charts) |

The spacing, type, radius, shadow and blur scales are **redefined in `@theme`**, so ordinary
utilities (`p-4`, `gap-2`, `text-lg`, `rounded-xl`, `shadow-md`, `blur-3xl`) produce dynamic
values. Use the normal utility names; never hand-write units.

**Height floors keep phones readable.** Type and spacing are width-driven on desktop, with a
viewport-height floor so a narrow phone does not shrink text to nothing:

```css
--spacing:   max(calc(0.18vw + 0.12vh), 0.42vh);
--text-base: max(calc(0.75vw + 0.6vh), 1.8vh);
```

Any new scale token must follow the same `max(width formula, height floor)` pattern.

Rules:
- ❌ Fixed-unit arbitrary values: `w-[300px]`, `h-[2rem]`, `max-w-[60ch]`.
- ✅ Dynamic arbitrary values when no token fits: `h-[40dvh]`, `max-w-[84vw]`, `-top-[5vh]`.
- ❌ Tailwind's fixed max-width presets (`max-w-md`, `max-w-screen-lg`) for layout.
- Borders, outlines and focus rings use Tailwind's own `border` / `ring-2` thickness. That is the
  only exemption.
- Breakpoints (`sm:` `md:` `lg:`) change layout (stacking, hiding the sidebar). Sizes inside each
  breakpoint stay dynamic. Every multi-column layout declares its mobile fallback explicitly.
- Icons size with the text: `size-[1.2em]`, never a pixel prop.

## 3. Colour: semantic tokens, three themes

### 3.1 Theming mechanism
- Every colour token is `light-dark(<light>, <dark>)` in `@theme`.
- The theme is the `color-scheme` on `<html>`, set with Tailwind's `scheme-light`,
  `scheme-dark` or `scheme-light-dark` class:
  - **Light** → `scheme-light`
  - **Dark** → `scheme-dark`
  - **System** → `scheme-light-dark` (follows the OS live, no JavaScript)
- `public/theme-init.js` applies the saved choice **before first paint** (external file because the
  CSP forbids inline scripts). `src/lib/theme/` holds the provider; `useTheme()` reads/sets it;
  `ThemeSwitcher` is the only UI for it. Storage key: `baddest.theme`.
- Sonner receives the same `'light' | 'dark' | 'system'` value (`ThemedToaster`).
- ❌ Never use raw palette classes (`bg-zinc-900`, `text-white`, `bg-indigo-500`). Use the tokens
  below, so one class re-themes everything. `dark:` is not needed and not configured.

### 3.2 Tokens

| Token | Role |
|---|---|
| `canvas` | page background |
| `surface` | cards, sidebar, inputs |
| `raised` | floating cards, dialogs, illustrations |
| `muted`, `muted-strong` | hover / pressed fills, tracks |
| `line`, `line-strong` | borders; input borders |
| `fg`, `fg-muted`, `fg-subtle` | text: primary, secondary, hints |
| `primary`, `primary-hover`, `primary-fg` | the accent, its hover, text on it |
| `primary-soft`, `primary-ink` | accent tint backgrounds; accent-coloured text/icons |
| kit aliases | shadcn names (`background`, `foreground`, `card`, `popover`, `muted-foreground`, `accent`, `destructive`, `border`, `input`, `--radius`) point at the tokens above |
| `--chart-*` | BkLit chart colours: emerald ramp `chart-1..5`, neutrals for grid, labels, tooltips |
| `danger`, `danger-hover`, `danger-fg`, `danger-soft`, `danger-ink` | destructive actions and errors |
| `ring` | focus rings |
| `overlay` | dialog scrim |

### 3.3 Palette rules
- **One accent: emerald.** No second accent anywhere (no blue links, no purple badges).
- Neutrals are cool zinc. **No pure `#fff` or `#000`.**
- Dark mode uses a lighter emerald with **dark** `primary-fg` so button text keeps AA contrast.
- Every text/background pair meets WCAG AA. Check new pairs in both themes.

## 4. Typography

- **Font: Outfit** (`@fontsource-variable/outfit`, self-hosted, imported in `main.tsx`; CSP-safe).
  `--font-sans` falls back to the system stack.
- Headlines: `font-semibold tracking-tight`, `text-balance`. Hero max 2 lines on desktop.
- Body: `text-fg-muted leading-relaxed`. Numbers in stats use `tabular-nums`.
- Emphasis inside a headline uses colour (`text-primary-ink`) or weight of the same family,
  never a second font.
- ❌ No em-dash (`—`) or en-dash (`–`) in any user-visible string. Use a hyphen, comma or period.

## 5. Shape, depth and texture

- **Radius scale (locked):** controls `rounded-lg`; cards `rounded-2xl`; large panels and bento
  cells `rounded-3xl`; pills and landing CTAs `rounded-full`. Do not mix outside this rule.
- Depth comes from `border-line` + a light shadow (`shadow-xs` on app cards, `shadow-md`/`lg` on
  floating elements). Shadows are viewport-unit tokens.
- Texture (landing and auth only): a dot grid
  (`bg-[radial-gradient(var(--color-line-strong)_0.08vw,transparent_0.09vw)] bg-size-[2.4vw_2.4vw]`
  with a radial mask) plus one soft `bg-primary/10 blur-3xl` wash. Never inside the app.
- Interactive feedback: `active:scale-[0.98]` on buttons and CTAs.
- All buttons, links and interactive kit controls use `cursor-pointer`; disabled controls use
  `cursor-not-allowed`. Tailwind descendant utilities on `body` cover portalled menus too.

## 6. Components (kit only, do not re-invent)

| Need | Use |
|---|---|
| Buttons | `kit/button` (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; `size="icon"` for icon-only, always with `aria-label` + `kit/tooltip`). Loading = `disabled` + `kit/spinner` in place of the icon |
| Text fields | `forms/TextField` (kit `field` + `input`); bare `kit/input` where the label is `sr-only` |
| Passwords | `forms/PasswordField` (kit `field` + `input-group`, show/hide with `aria-pressed`) on **every** password field |
| Long text | `kit/textarea` inside a kit `Field` |
| Checkboxes | `kit/checkbox` (`onCheckedChange`) |
| Surfaces | `kit/card` (`CardHeader`, `CardTitle`, `CardAction`, `CardContent`) |
| Progress | `kit/progress` with `aria-label` |
| Filters / views | `kit/tabs` |
| Menus | `kit/dropdown-menu`; floating panels `kit/popover`; pickers `kit/select` |
| Confirm destructive | `feedback/ConfirmDialog` (kit `alert-dialog`) |
| Tooltips | `kit/tooltip`; one `TooltipProvider` in `main.tsx` |
| Toasts | `kit/sonner` `Toaster` (bottom-right) via `feedback/toast.ts` `notify` |
| Theme | `layout/ThemeSwitcher` (kit `dropdown-menu` in the sidebar, `toggle-group` elsewhere) |
| Empty / loading | `feedback/EmptyState` (kit `empty`), `feedback/LoadingState` (kit `spinner`) |
| Brand | `layout/Brand` (logo mark + wordmark) |

Need something not listed? Install it from the kit first; only compose it, never hand-build it.

## 7. Layouts

### 7.1 Landing (`/`, `pages/public/LandingPage.tsx`)
Section order, each a different layout family:
1. **Floating pill nav** (`LandingNav`): transparent at top, `surface/85` + blur + shadow once
   scrolled; links Features / How it works / Privacy; theme switcher; Sign in + Get started.
   Below `md` it collapses to a menu button with a panel.
2. **Hero, split**: badge, 2-line headline with an accent phrase, ≤20-word subtext, one primary
   (Get started) + one secondary CTA. Right: collage of the live `TodoDemo` with floating
   vignettes. Nothing else in the hero.
3. **Benefits strip**: 4 icon + title + line items, full-width band.
4. **Feature rows**: max 2 alternating text/illustration rows.
5. **Bento**: exactly as many cells as items, asymmetric, varied backgrounds.
6. **How it works**: 3 icon steps with verb labels (no "Step 1").
7. **Privacy**: statement left, detail cards right.
8. **Closing CTA band** in `bg-primary`, then a multi-column footer.

One label per intent: "Get started" is the only sign-up CTA label on the page.

### 7.2 Auth (`/sign-in`, `/sign-up`, `layouts/PublicLayout.tsx`)
Two columns from `lg` (`grid-cols-[5fr_7fr]`): textured brand panel (headline, three trust
points, live `TodoDemo` + assistant vignette) and the form in a `rounded-3xl` card. Below `lg`,
form only with the brand above it. Top bar: Home link + theme switcher.

### 7.3 App (`/dashboard/*`, `layouts/DashboardLayout.tsx`)
- Fixed sidebar, collapsed on every dashboard load (icon rail + tooltips); manual expansion lasts
  through in-app navigation but is not restored on reload. Only `main`
  scrolls. No top navbar. Theme menu, avatar initials + name/email, and sign out live in the sidebar footer.
- The collapse/expand control is always at the top. In collapsed mode it replaces the logo;
  expanded mode shows the brand beside the collapse control. Sidebar widths have height-based floors for phones.
- Page content is centred with `mx-auto max-w-[72vw]–[78vw]`, full width below `lg`.
- **Overview shows real data**: greeting + date, quick add, three stat tiles, "Up next" (live,
  tickable open to-dos with progress), "Recent notes", and a compact "Coming next" chip row.
  Never placeholder cards.
- Lists inside a `Card` use `divide-y divide-line` rows, not separate bordered boxes. Row actions
  appear on hover/focus on desktop and are always visible on touch.
- Overview leads with an emerald-tinted quick-add and completion panel. `DashboardMetric`
  composes kit cards for real overview, task, shopping and budget totals.
- Notes pair a divided notebook list with a larger writing panel. Calendar highlights the
  selected-day agenda. Vault setup and unlock use narrower centred forms.
- Budget leads with BkLit daily spending and grouped spending-versus-limit charts. Each budget
  uses its own current period. Hide each entire chart panel when its data is empty; show a single
  available chart full-width and omit the chart section when neither has data. Never invent values.

## 8. Illustrations

- There is no image-generation tool, so illustrations are **vignettes built from the app's own
  tokens and shapes** (`components/landing/Illustrations.tsx`): note, budget, shopping,
  reminder, calendar, vault, assistant.
- Every vignette is `aria-hidden="true"`: it is a picture, and its numbers and text are example
  content.
- Vignettes appear **only** on the landing and auth pages. App pages show the user's real data.
- `TodoDemo` is a working component (local state only), not a picture.
- ❌ No hand-drawn decorative SVG, no external stock images (CSP is `img-src 'self' data:`).

## 9. Charts and graphs: BkLit only

- **Every** chart, graph, sparkline or gauge comes from the **BkLit** registry (`@bklit`), per
  `docs/Frontend-UI-Motion-Tooling-Standard.md`. Install with `pnpm dlx shadcn@latest add @bklit/<chart>`
  after checking current BkLit docs.
- ❌ No hand-rolled SVG/canvas charts, no other chart library, no CSS-drawn bar graphs in the app.
  (Landing vignettes are illustrations, not charts, and carry no real data.)
- Wrap each chart once in `src/components/charts/`; feed data through props from hooks; colours
  from tokens; provide loading, empty, error, responsive, accessible and reduced-motion states.

## 10. Motion

- `motion/react` only. Hero items rise in on load; landing sections reveal once on scroll.
- Every animation respects `useReducedMotion()` / `motion-reduce:`.
- Animate `transform` and `opacity`. No infinite decorative loops.

## 11. Review checklist (every UI change)

- [ ] `pnpm exec tsc -b` and `pnpm lint` clean
- [ ] `grep -rnE '[0-9.]+(px|rem)\b' src index.html public/theme-init.js | grep -vE 'components/(kit|charts)/'` → no matches
- [ ] `grep -rn 'style=\|@apply' src | grep -vE 'components/(kit|charts)/'` → no matches
- [ ] No raw palette classes: `grep -rnoE '\b(bg|text|border|ring)-(neutral|indigo|zinc|gray|slate|white|black)' src | grep -vE 'components/(kit|charts)/'` → none
- [ ] No raw controls outside the kit: `grep -rnE '<(button|input|textarea|select)\b' src --include=*.tsx | grep -vE 'components/(kit|charts)/'` → none
- [ ] No `—` / `–` in visible strings
- [ ] Checked in Light, Dark and System, at phone and desktop widths
- [ ] Password fields use `forms/PasswordField`; every control is a kit component
- [ ] Any chart is a BkLit wrapper in `components/charts/`, fed by props
- [ ] Reduced motion and keyboard focus verified
