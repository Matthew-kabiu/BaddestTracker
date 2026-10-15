# Vite + React Frontend Technical Specification

> **Version:** 1.0.0 | **Status:** Living Document | **Last Updated:** 2026
> **Author:** Matthew Makundi — SpookieLabsInc
> **Purpose:** Authoritative reference for all Vite + React SPA architecture, UI standards, security, and DevOps decisions. Companion to `NextJS-Build-Template.md` (shared rules are restated here so this file stands alone) and to `Backend-Build-Template.md`, whose design-pattern philosophy (singleton, factory, builder) applies throughout. All agents and contributors MUST follow this specification without deviation.

**When to use Vite over Next.js:** pure SPA/dashboard behind auth, no SEO requirement, no server rendering, or when pairing with the SpookieLabs Express backend as the sole data layer. If the project needs SEO, server rendering, or content pages — use the Next.js template instead.

---

## Table of Contents

1. [Document Purpose & LLM Rules](#1-document-purpose--llm-rules)
2. [Architecture Overview](#2-architecture-overview)
3. [Folder Structure & Module Rules](#3-folder-structure--module-rules)
4. [Centralized Routes File](#4-centralized-routes-file)
5. [Singleton API Client](#5-singleton-api-client)
6. [UI Standards — Toasts, Tooltips, Buttons, Icons](#6-ui-standards--toasts-tooltips-buttons-icons)
7. [Error Handling & Error Boundaries](#7-error-handling--error-boundaries)
8. [Dashboard Layout System](#8-dashboard-layout-system)
9. [Security — OWASP for the SPA](#9-security--owasp-for-the-spa)
10. [Environment Configuration](#10-environment-configuration)
11. [Docker & Nginx — Dev & Production](#11-docker--nginx--dev--production)
12. [Vite & React Best Practices](#12-vite--react-best-practices)
13. [Verification Policy — Lint, Type Checks, Builds, React Doctor](#13-verification-policy)
14. [Dependency Policy](#14-dependency-policy)
15. [Implementation Checklist](#15-implementation-checklist)
16. [What NOT To Do](#16-what-not-to-do)

---

## 1. Document Purpose & LLM Rules

### 1.1 Mandatory LLM Behavioral Rules

```
╔══════════════════════════════════════════════════════════════════════╗
║  RULE 1: THINK LIKE A SENIOR ENGINEER                                ║
║  Production-grade always — even when the project is a side hobby.    ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 2: NEVER ASSUME — ALWAYS SEEK CLARIFICATION                    ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 3: SECURITY IS DESIGNED IN                                     ║
║  OWASP on every form, fetch, render, redirect. Never hardcode        ║
║  secrets or credentials. Anywhere. Ever.                             ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 4: NO NEW DEPENDENCIES WITHOUT EXPLICIT APPROVAL               ║
║  Propose → wait for Matthew's approval → then install.               ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 5: VERIFICATION CADENCE IS FIXED                               ║
║  ALWAYS lint + type check after each unit of work.                   ║
║  NEVER run production build checks until explicitly told.            ║
║  React Doctor only when told; recommend once at project completion.  ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 6: ABSTRACTION IS MANDATORY                                    ║
║  Singleton apiClient, factory error map, builder helpers. No         ║
║  scattered fetch calls, toast logic, or route strings.               ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 7: NO HARDCODED PORTS OR HOSTS                                 ║
║  Ports/hosts come from .env — in code, Docker, compose, AND docs.    ║
╠══════════════════════════════════════════════════════════════════════╣
║  RULE 8: RAW BACKEND ERRORS NEVER REACH THE USER                     ║
║  Toasts/error UIs show mapped friendly messages only.                ║
╚══════════════════════════════════════════════════════════════════════╝
```

Clarification protocol: state what is unclear → list interpretations → ask → wait.

---

## 2. Architecture Overview

### 2.1 System Shape

```
Browser
   │
   ▼
[Nginx] — serves built SPA, security headers, gzip, /health
   │           (internal port from FRONTEND_PORT in the selected env file)
   ▼
[React SPA] — React Router, client-side rendering only
   │
   ▼
[apiClient singleton] → ROUTES (single source of paths)
   │
   ▼
[Express Backend /api/v1/*]  (full-stack)  — Backend-Build-Template.md
   or
[External APIs via backend proxy ONLY]     — a SPA has NO server-side
                                             secrets; anything secret
                                             must live behind a backend
```

**Critical difference from Next.js:** a Vite SPA has no server runtime. Every `VITE_*` env var is inlined into the public JS bundle at build time. Therefore a Vite project that needs ANY secret (LLM keys, API credentials) REQUIRES a backend — there is no frontend-only-with-secrets shape here.

### 2.2 Data Flow

```
Component → hook → apiClient (singleton) → envelope parsing
                        │
                        ├── Success → typed data → UI
                        └── Failure → ApiClientError (mapped message)
                                         │→ notify.error → friendly toast
                                         │→ raw detail → dev console only
```

---

## 3. Folder Structure & Module Rules

```
frontend/
├── src/
│   ├── main.tsx                   # Entry: providers, router, <Toaster/>, <AppTooltip/>
│   ├── App.tsx                    # Route table ONLY — no page logic
│   ├── index.css                  # Design tokens + resets only
│   │
│   ├── pages/
│   │   ├── public/                # Login, Register, NotFound
│   │   └── dashboard/             # Pages rendered inside DashboardLayout
│   │
│   ├── layouts/
│   │   ├── PublicLayout.tsx
│   │   └── DashboardLayout.tsx    # GLOBAL dashboard layout (Section 8)
│   │
│   ├── components/
│   │   ├── ui/                    # Button, Input, Card, AppTooltip …
│   │   ├── layout/                # Sidebar, Topbar
│   │   ├── feedback/              # ErrorBoundary, ErrorFallback, toast.ts,
│   │   │                          #   EmptyState, LoadingState
│   │   └── {feature}/             # Feature-scoped components
│   │
│   ├── lib/
│   │   ├── routes.ts              # ★ Centralized routes (Section 4)
│   │   ├── api/
│   │   │   ├── apiClient.ts       # ★ Singleton API client (Section 5)
│   │   │   └── errorMap.ts        # code → friendly message (factory lookup)
│   │   ├── config/
│   │   │   └── env.ts             # Validated import.meta.env (singleton)
│   │   ├── builders/              # Builder-pattern helpers
│   │   └── utils/
│   │
│   ├── hooks/                     # use-*.ts
│   ├── context/                   # React context providers (auth, theme)
│   └── types/                     # Shared TS types & DTOs
│
├── public/
├── nginx.conf                     # Production serving (Section 11)
├── Dockerfile.dev
├── Dockerfile.prod
├── docker-compose.dev.yml         # Standalone; full-stack uses backend compose
├── vite.config.ts
├── .env.example                   # Committed — fake values only
├── .env.development               # NOT committed
└── tsconfig.json
```

**Module rules** (same table as Next.js template): feature components under `components/{feature}/`, primitives generic in `ui/`, route strings only in `lib/routes.ts`, fetches only through `apiClient`, page components compose — they don't own business logic.

---

## 4. Centralized Routes File

**MANDATORY.** One file defines every backend API route and every SPA page path. Backend routes are declared here and exported to all frontend consumers. No literal URL/path strings anywhere else — including `<Route path>` definitions, `navigate()` calls, and redirects.

```typescript
// src/lib/routes.ts
import { env } from '@/lib/config/env';

const API_V1 = `${env.VITE_API_BASE_URL}/v1`;

/** Backend API routes — mirrors backend {feature}_module route files. */
export const API_ROUTES = {
  health: `${env.VITE_API_BASE_URL}/health`,
  auth: {
    login: `${API_V1}/auth/login`,
    register: `${API_V1}/auth/register`,
    refresh: `${API_V1}/auth/refresh`,
    logout: `${API_V1}/auth/logout`,
  },
  user: {
    me: `${API_V1}/users/me`,
    byId: (id: string) => `${API_V1}/users/${id}`,
  },
} as const;

/** SPA page routes — used by the router table AND all navigation. */
export const PAGE_ROUTES = {
  home: '/',
  auth: { login: '/login', register: '/register' },
  dashboard: {
    root: '/dashboard',
    settings: '/dashboard/settings',
    reports: (id: string) => `/dashboard/reports/${id}`,
    // Router-table patterns live beside their builders:
    patterns: { reports: '/dashboard/reports/:id' },
  },
} as const;

export const ROUTES = { api: API_ROUTES, pages: PAGE_ROUTES } as const;
```

```tsx
// src/App.tsx — route table consumes ROUTES; never literal strings
<Route path={ROUTES.pages.dashboard.root} element={<DashboardLayout />}>
  <Route index element={<DashboardHome />} />
  <Route path={ROUTES.pages.dashboard.patterns.reports} element={<ReportPage />} />
</Route>
```

Rules: dynamic segments are functions; `as const` everywhere; router `:param` patterns live in `patterns` next to their builder functions so table and navigation can never drift apart.

---

## 5. Singleton API Client

**MANDATORY.** Identical contract to the Next.js template — one singleton defines and initiates ALL API methods; components never call `fetch`/`axios` directly.

```typescript
// src/lib/api/apiClient.ts
import { ROUTES } from '@/lib/routes';
import { mapErrorToMessage } from '@/lib/api/errorMap';
import type { ApiEnvelope } from '@/types/api';

export class ApiClientError extends Error {
  constructor(
    public userMessage: string,   // friendly — the ONLY thing UIs may show
    public code: string,
    public statusCode: number,
  ) {
    super(userMessage);
  }
}

class ApiClient {
  private static instance: ApiClient;
  private constructor() {}

  static getInstance(): ApiClient {
    if (!ApiClient.instance) ApiClient.instance = new ApiClient();
    return ApiClient.instance;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        credentials: 'include',              // httpOnly cookie auth — no localStorage tokens
        headers: { 'Content-Type': 'application/json', ...init.headers },
      });
      const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;

      if (!res.ok || !body?.success) {
        const code = body?.error ?? 'UNKNOWN_ERROR';
        if (import.meta.env.DEV) console.error('[apiClient]', res.status, code, body?.message);
        throw new ApiClientError(mapErrorToMessage(code, res.status), code, res.status);
      }
      return body.data;
    } catch (err) {
      if (err instanceof ApiClientError) throw err;
      throw new ApiClientError(mapErrorToMessage('NETWORK_ERROR', 0), 'NETWORK_ERROR', 0);
    } finally {
      clearTimeout(timeout);
    }
  }

  private get = <T>(url: string) => this.request<T>(url);
  private post = <T>(url: string, data?: unknown) =>
    this.request<T>(url, { method: 'POST', body: JSON.stringify(data) });
  private put = <T>(url: string, data?: unknown) =>
    this.request<T>(url, { method: 'PUT', body: JSON.stringify(data) });
  private delete = <T>(url: string) => this.request<T>(url, { method: 'DELETE' });

  /** ─── Public surface — mirrors API_ROUTES exactly ─── */
  auth = {
    login: (dto: LoginDTO) => this.post<Session>(ROUTES.api.auth.login, dto),
    logout: () => this.post<void>(ROUTES.api.auth.logout),
  };
  user = {
    me: () => this.get<User>(ROUTES.api.user.me),
  };
}

export const apiClient = ApiClient.getInstance();
```

`errorMap.ts` is identical to the Next.js template: a factory lookup from backend error codes (`VALIDATION_ERROR`, `UNAUTHORIZED`, `RATE_LIMIT_EXCEEDED`, …) to friendly copy, with status-based fallbacks. New backend endpoint ⇒ same PR updates `API_ROUTES` + `apiClient` + types.

---

## 6. UI Standards — Toasts, Tooltips, Buttons, Icons

### 6.1 Toasts — Sonner (MANDATORY)

```tsx
// src/main.tsx
import { Toaster } from 'sonner';
// …
<StrictMode>
  <RouterProvider router={router} />
  <Toaster position="top-right" richColors closeButton />
  <AppTooltip />
</StrictMode>
```

```typescript
// src/components/feedback/toast.ts — the ONLY toast entry point
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api/apiClient';

export const notify = {
  success: (msg: string) => toast.success(msg),
  info: (msg: string) => toast.info(msg),
  warning: (msg: string) => toast.warning(msg),
  error: (err: unknown, fallback = 'Something went wrong. Please try again.') => {
    const msg = err instanceof ApiClientError ? err.userMessage : fallback;
    toast.error(msg);              // NEVER the raw backend message
  },
  promise: toast.promise,
};
```

### 6.2 Tooltips — React Tooltip (MANDATORY)

One global `react-tooltip` instance (`<AppTooltip/>` with `id="app-tooltip"`, mounted once in `main.tsx`), anchored via `data-tooltip-id`/`data-tooltip-content`. Every icon-only control has a tooltip AND `aria-label`. No ad-hoc tooltip implementations.

### 6.3 Buttons — Every Button Has Its Related Icon (MANDATORY)

The `Button` primitive requires an `icon: LucideIcon` prop (no icon → type error), supports `iconPosition`, `loading` (spinner replaces icon, button disabled), and `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`. Icon semantics: save → check, delete → trash, run/submit → play/arrow, export → download, cancel → x, add → plus. Destructive actions: `danger` variant + confirmation step. (Implementation identical to NextJS-Build-Template §6.3.)

### 6.4 General UI Rules

Loading/empty/error states mandatory on every data surface; keyboard accessibility + visible focus; respect `prefers-reduced-motion`.

---

### 6.5 Standard UI and Motion Toolchain (MANDATORY)

This template is governed by [[Frontend-UI-Motion-Tooling-Standard]]. Before selecting UI components, charts, or animation APIs, consult the current official documentation:

- Kokonut UI Pro reference supplied by Matt: https://kokonutui.pro/docs
- Kokonut UI **free** installation and registry: https://kokonutui.com/docs
- Motion: https://motion.dev/docs
- Anime.js: https://animejs.com/documentation/
- BkLit: https://bklit.com/docs/installation

Kokonut is **free-plan only**: use `@kokonutui` with `https://kokonutui.com/r/{name}.json`; never configure `@kokonutui-pro` or `KOKO_PRO_TOKEN`. Motion is the default React interaction engine. Anime.js v4 is reserved for justified timelines, SVG, text, drag, and advanced sequencing. BkLit is the standard chart source. Install only what the feature scope uses, centralize effects, and provide cleanup and reduced-motion behavior.

"Mandatory" here means mandatory *when a lane applies*. See the precedence list in [[Frontend-UI-Motion-Tooling-Standard]]: a project's architecture adoption contract outranks this section on whether a lane applies to that project at all, and a documented refusal is a decision rather than a deviation. Reduced-motion and keyboard accessibility hold regardless.

## 7. Error Handling & Error Boundaries

### 7.1 Centralized Error Boundary Wrapper (MANDATORY)

The SPA has no framework-provided boundaries, so the wrapper is explicit — one reusable class boundary + one friendly fallback UI, wrapped at the router root AND around risky widgets.

```tsx
// src/components/feedback/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Raw error → dev console / monitoring hook. NEVER the UI.
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorFallback reset={this.reset} />;
    }
    return this.props.children;
  }
}
```

`ErrorFallback` is the single friendly error page (headline, "not your fault" copy, `Try again` + `Go home` buttons with icons, no technical detail) — same design as NextJS-Build-Template §7.1. React Router's `errorElement` on the root route also renders `<ErrorFallback/>` so routing/loader errors get the same treatment.

```tsx
// src/main.tsx — boundary wraps the entire app
<ErrorBoundary>
  <RouterProvider router={router} />
</ErrorBoundary>
```

### 7.2 Error Display Rules

Same matrix as Next.js template: API failures → mapped toast via `notify.error`; render crashes → `ErrorFallback`; validation → inline field messages; unknown routes → NotFound page. NEVER render `error.message`, stacks, or backend `message` fields. NEVER leave a catch block empty.

---

## 8. Dashboard Layout System

### 8.1 Global Dashboard Layout (MANDATORY)

ALL dashboard pages render inside one `DashboardLayout` via a parent route + `<Outlet/>`. No per-page shells.

**Sidebar behavior — non-negotiable:**
- **Collapsed by default** (icon rail); expansion is user-triggered and persisted (localStorage is fine here — it's a UI preference, not a credential).
- **Fixed position — never scrolls with the page.** Only the main content area scrolls.

```tsx
// src/layouts/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export function DashboardLayout() {
  return (
    <div className="min-h-dvh">
      {/* position: fixed; inset-y-0 left-0; width: var(--sidebar-w) */}
      <Sidebar />
      {/* offset by rail width — the ONLY scroll container */}
      <div className="flex min-h-dvh flex-col pl-[var(--sidebar-w)] transition-[padding]">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-[var(--gutter)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

```css
/* index.css */
:root {
  --sidebar-w-collapsed: 4rem;
  --sidebar-w-expanded: 16rem;
  --sidebar-w: var(--sidebar-w-collapsed);   /* collapsed by default */
}
```

### 8.2 Layout Rules

- Nav is a config array (`{ label, href: ROUTES.pages.dashboard.root, icon }[]`) — collapsed state shows icon-only items with tooltips.
- Active state via `useLocation()` compared against `ROUTES.pages`.
- Auth gating in a `RequireAuth` wrapper around the dashboard route group — remembering that client-side gating is UX ONLY; the backend enforces the real boundary (Backend §14).
- Topbar owns breadcrumbs/user menu/global actions; pages own only content.

---

## 9. Security — OWASP for the SPA

| # | Vulnerability | SPA Mitigations |
|---|---------------|-----------------|
| A01 | Broken Access Control | `RequireAuth` route wrapper is UX only — every real check is backend RBAC; never trust client role state for sensitive rendering of data (fetch returns only what the role allows) |
| A02 | Cryptographic Failures | httpOnly cookie sessions; ❌ tokens in localStorage (Backend §20); HTTPS assumed |
| A03 | Injection/XSS | React escaping; `dangerouslySetInnerHTML` forbidden without sanitization + justification; zod-validate form input client-side (UX) knowing the backend re-validates (security) |
| A05 | Misconfiguration | Security headers served by Nginx (Backend §10.1 config verbatim); `server_tokens off` |
| A06 | Vulnerable Components | `npm audit` before proposing deps; pinned versions; approval required |
| A07 | Auth Failures | Generic auth error copy; session expiry → friendly re-login flow, no enumeration hints |
| A08 | Integrity | No untrusted third-party scripts; SRI if any external resource is approved; lockfile committed |
| A09 | Logging | No PII/tokens in console; `import.meta.env.DEV`-gated logging stripped from prod builds |

**Hard rules:** no hardcoded secrets/credentials anywhere (code, compose, docs); `VITE_*` vars are PUBLIC by definition — a secret in a `VITE_` var is shipped to every visitor, so secrets live only behind the backend.

---

## 10. Environment Configuration

### 10.1 Environment Files

| File | Used By | Committed? |
|------|---------|-----------|
| `.env.example` | Documentation only — fake values | ✅ Yes |
| `.env.development` | Dev Docker Compose / local dev | ❌ No |
| `.env` | Production (Coolify injects as build args) | ❌ Never |

### 10.2 Validated Env Singleton

```typescript
// src/lib/config/env.ts — fail fast at module load
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_APP_NAME: z.string().min(1),
  VITE_ENVIRONMENT: z.enum(['development', 'production']).default('development'),
});

const parsed = envSchema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}
export const env = parsed.data;
```

### 10.3 `.env.example`

```bash
# Public — inlined into the JS bundle at BUILD time. NEVER secrets.
VITE_API_BASE_URL=http://localhost:CHANGE_ME_BACKEND_PORT/api
VITE_APP_NAME=App
VITE_ENVIRONMENT=development

# Docker port mapping (host side) — never hardcode in code/docs
FRONTEND_PORT=CHANGE_ME_EXTERNAL_PORT
VITE_DEV_PORT=CHANGE_ME_DEV_SERVER_PORT
```

**Rules:** `VITE_*` = public. Prod values are **build args** (the bundle is baked at build time — changing env post-build requires a rebuild). Ports appear ONLY in `.env*`; everything else references `${FRONTEND_PORT}` / `${VITE_DEV_PORT}`.

---

## 11. Docker & Nginx — Dev & Production

Two-environment principle (Backend §9.1) applies. All builds use **BuildKit** (`DOCKER_BUILDKIT=1`) with cache mounts. Both internal and external ports are required environment values. The root Compose files and README define this project's deployment contract.

### 11.1 Dockerfile.dev — Vite dev server + HMR

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Source volume-mounted at runtime for hot reload
ARG VITE_DEV_PORT
ENV VITE_DEV_PORT=${VITE_DEV_PORT}
EXPOSE ${VITE_DEV_PORT}

# Reliable file-watching inside containers
ENV CHOKIDAR_USEPOLLING=true

CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port ${VITE_DEV_PORT}"]
```

```typescript
// vite.config.ts — HMR through Docker port mapping
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.VITE_DEV_PORT),
    strictPort: true,
    watch: { usePolling: true },
    hmr: { clientPort: Number(process.env.FRONTEND_PORT) },  // browser-side port
  },
  build: {
    target: 'es2022',
    sourcemap: false,           // no source maps shipped to prod
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
});
```

### 11.2 Dockerfile.prod — multi-stage → Nginx

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_APP_NAME
ARG VITE_ENVIRONMENT=production
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# ────────────────────────────────────────
FROM nginx:alpine AS production

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The nginx listen port is rendered from FRONTEND_PORT at container start.
CMD ["nginx", "-g", "daemon off;"]
```

### 11.3 nginx.conf

Use the Backend template §10.1 config **verbatim**: security headers (CSP, HSTS, nosniff, frame-options, permissions-policy), `server_tokens off`, `/health` endpoint returning `200 OK`, 1-year immutable caching for hashed static assets, gzip, SPA `try_files … /index.html` routing, hidden-file denial.

### 11.4 docker-compose.dev.yml (standalone frontend)

```yaml
services:
  frontend:
    container_name: frontend_dev
    build:
      context: .
      dockerfile: Dockerfile.dev
      args:
        VITE_DEV_PORT: ${VITE_DEV_PORT:?set in .env.development}
    ports:
      - "${FRONTEND_PORT:?set in .env.development}:${VITE_DEV_PORT}"
    volumes:
      - ./src:/app/src:rw
      - ./public:/app/public:ro
      - ./index.html:/app/index.html:ro
      - ./vite.config.ts:/app/vite.config.ts:ro
      - /app/node_modules
    env_file: .env.development
```

Full-stack projects: drop this service into the backend's `docker-compose.dev.yml` / `docker-compose.prod.yml` (Backend §9.4/§9.5) on the shared network, with the prod service using `Dockerfile.prod`, `"${HOST_BIND_ADDRESS}:${FRONTEND_HOST_PORT}:${FRONTEND_PORT}"` mapping, resource limits, and the Nginx `/health` healthcheck. Every port is required from the selected root environment file.

---

## 12. Vite & React Best Practices

- **Route-level code splitting**: `React.lazy` + `<Suspense>` per page; vendor chunk split via `manualChunks`.
- **State discipline**: server state via `apiClient` + hooks (or approved query lib); UI state local; context only for genuinely global concerns (auth, theme). No global-store reflex.
- **Memoize deliberately**, not defensively — profile first.
- **Assets through Vite imports** (hashed, cacheable) — no string paths into `/public` except favicons/robots.
- **`index.html` is the SEO surface** — title, description, og tags set once; SPAs are not SEO plays (that's the Next.js template's job).
- **Type-safe forms**: zod schema → parse on submit → inline field errors; backend re-validation is the security layer.
- **Dev-only logging** behind `import.meta.env.DEV`.
- **Accessibility**: semantic HTML, labeled controls, focus management in dialogs/menus.

---

## 13. Verification Policy

```
╔══════════════════════════════════════════════════════════════════╗
║  AFTER EVERY UNIT OF WORK (always, unprompted):                 ║
║    • npm run lint                                                ║
║    • npx tsc --noEmit          (type check)                      ║
║                                                                  ║
║  ONLY WHEN MATTHEW EXPLICITLY SAYS SO:                          ║
║    • npm run build             (production build check)          ║
║    • React Doctor              (full health scan)                ║
║                                                                  ║
║  REACT DOCTOR RECOMMENDATION TIMING:                             ║
║    Recommend ONCE when the project is complete —                 ║
║    NOT at each phase/module completion.                          ║
╚══════════════════════════════════════════════════════════════════╝
```

Record results in the SOP verification format. "Not run: build (awaiting Matthew's go-ahead)" is the expected default line.

---

## 14. Dependency Policy

- ❌ No adding, removing, upgrading, or swapping dependencies outside the globally approved baseline without Matthew's explicit permission.
- Proposal format for non-baseline packages: package name, purpose, size/maintenance status, `npm audit` result, alternative considered. Then WAIT.
- Standard approved baseline (install only what the project uses): `react`, `react-dom`, `react-router-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `zod`, `sonner`, `react-tooltip`, the chosen icon package, `eslint` + config, `tailwindcss` v4 where compatible, `motion`, `animejs`, and shadcn registry source from free `@kokonutui` and `@bklit`.
- Approval is not an instruction to install every package. Motion is the default React interaction runtime; Anime.js and BkLit are on-demand according to [[Frontend-UI-Motion-Tooling-Standard]].
- Pin versions, commit the lockfile, read current official docs before first use or upgrade, and run `npm audit`.

## 15. Implementation Checklist

**Planning**
- [ ] Requirements clear (asked if not) · threat model done · Vite-vs-Next choice justified (no SEO/SSR need)

**Scaffold**
- [ ] Folder structure matches Section 3 · env validated via `lib/config/env.ts` · `.env.example` updated
- [ ] `ROUTES` + `apiClient` + `errorMap` in place · `<Toaster/>` + `<AppTooltip/>` + root `<ErrorBoundary/>` mounted in `main.tsx`
- [ ] Router table consumes `ROUTES.pages` · `errorElement` + NotFound wired
- [ ] `DashboardLayout` with fixed, collapsed-by-default sidebar · `RequireAuth` wrapper on dashboard group

**Per Feature**
- [ ] Page lazy-loaded · components under correct feature folder
- [ ] All paths from `ROUTES` · all fetches via `apiClient` · types/DTOs defined
- [ ] Buttons have related icons · icon-only controls have tooltip + aria-label
- [ ] Toasts via `notify` — friendly messages only · loading/empty/error states present
- [ ] Forms zod-validated · no secrets, no hardcoded ports/hosts anywhere

**Verification (every unit of work)**
- [ ] Lint passed · type check passed · build NOT run (unless told) · results recorded per SOP

**Handoff**
- [ ] Changelog + Agenthandoff updated when behavior/contracts changed

---

## 16. What NOT To Do

### Architecture Violations
- ❌ Literal URL/path strings in components, hooks, router table, or `navigate()` calls (use `ROUTES`)
- ❌ `fetch()`/`axios` outside `apiClient`
- ❌ Business logic inside page components (compose from hooks + services)
- ❌ Per-page dashboard shells or a second sidebar implementation
- ❌ A second toast or tooltip system alongside Sonner / React Tooltip

### Security Violations
- ❌ Hardcoded secrets/credentials — code, compose, Dockerfiles, `.md` files, anywhere
- ❌ ANY secret in a `VITE_*` var (it ships in the public bundle)
- ❌ Tokens in localStorage · trusting client-side auth gating as a security boundary
- ❌ Raw backend errors, stacks, or `error.message` shown to users (toasts included)
- ❌ `dangerouslySetInnerHTML` without sanitization + written justification
- ❌ Committing `.env` files with real values · shipping source maps to production

### UI Violations
- ❌ Icon-less buttons · icon-only controls without tooltip + aria-label
- ❌ Empty catch blocks · data surfaces without loading/empty/error states
- ❌ Sidebar that scrolls with the page or ships expanded by default

### Process Violations
- ❌ Adding dependencies without approval
- ❌ Running `npm run build` before being told
- ❌ Skipping lint/type checks after a unit of work
- ❌ Recommending React Doctor at each phase (once, at project completion)
- ❌ Hardcoding ports — in code OR documentation

### DevOps Violations
- ❌ Single Dockerfile for both envs · dev container without HMR (volume mounts + polling + `hmr.clientPort`)
- ❌ Internal prod container port other than 80 · missing Nginx config in the frontend image
- ❌ Builds without BuildKit cache mounts · missing resource limits / healthchecks in prod compose

---

*This document is a living specification. Update it whenever architecture evolves. Every contributor and AI assistant is bound by these rules.*

---

**© 2026 Matthew Makundi — SpookieLabsInc. All rights reserved.**
