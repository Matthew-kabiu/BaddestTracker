// Same origin everywhere: nginx proxies /api in production, Vite's dev server locally.
const API = '/api'
const API_V1 = `${API}/v1`

/** Backend API routes — the only place backend URLs are written. */
export const API_ROUTES = {
  health: `${API}/health`,
  todos: {
    list: `${API_V1}/todos`,
    create: `${API_V1}/todos`,
    byId: (id: string) => `${API_V1}/todos/${encodeURIComponent(id)}`,
  },
  notes: {
    list: `${API_V1}/notes`,
    create: `${API_V1}/notes`,
    byId: (id: string) => `${API_V1}/notes/${encodeURIComponent(id)}`,
  },
  shopping: {
    list: `${API_V1}/shopping`,
    create: `${API_V1}/shopping`,
    byId: (id: string) => `${API_V1}/shopping/${encodeURIComponent(id)}`,
  },
  budgets: {
    /** `on` = the caller's local today (YYYY-MM-DD); picks each budget's current window. */
    list: (on: string) => `${API_V1}/budgets?on=${encodeURIComponent(on)}`,
    create: `${API_V1}/budgets`,
    byId: (id: string) => `${API_V1}/budgets/${encodeURIComponent(id)}`,
  },
  expenses: {
    list: (from: string, to: string) =>
      `${API_V1}/expenses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    create: `${API_V1}/expenses`,
    byId: (id: string) => `${API_V1}/expenses/${encodeURIComponent(id)}`,
  },
  calendar: {
    /** Occurrences overlapping the days from..to (YYYY-MM-DD, inclusive). */
    list: (from: string, to: string) =>
      `${API_V1}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    create: `${API_V1}/calendar`,
    byId: (id: string) => `${API_V1}/calendar/${encodeURIComponent(id)}`,
  },
  vault: {
    root: `${API_V1}/vault`,
    key: `${API_V1}/vault/key`,
    items: `${API_V1}/vault/items`,
    itemById: (id: string) => `${API_V1}/vault/items/${encodeURIComponent(id)}`,
  },
  telegram: {
    status: `${API_V1}/telegram`,
    confirm: `${API_V1}/telegram/confirm`,
    test: `${API_V1}/telegram/test`,
  },
  notifications: {
    list: `${API_V1}/notifications`,
    readAll: `${API_V1}/notifications/read-all`,
    byId: (id: string) => `${API_V1}/notifications/${encodeURIComponent(id)}`,
  },
  ai: {
    keys: `${API_V1}/ai/keys`,
    keyByProvider: (provider: string) => `${API_V1}/ai/keys/${encodeURIComponent(provider)}`,
    chat: `${API_V1}/ai/chat`,
  },
  /** Server-Sent Events stream of live changes (opened by LiveEventsProvider). */
  events: `${API_V1}/events`,
} as const

/** SPA page routes — used by the router table AND every navigation. */
export const PAGE_ROUTES = {
  home: '/',
  auth: {
    signIn: '/sign-in',
    signUp: '/sign-up',
  },
  dashboard: {
    root: '/dashboard',
    todos: '/dashboard/todos',
    notes: '/dashboard/notes',
    shopping: '/dashboard/shopping',
    budget: '/dashboard/budget',
    calendar: '/dashboard/calendar',
    vault: '/dashboard/vault',
    ai: '/dashboard/ai',
    settings: '/dashboard/settings',
  },
  notFound: '*',
} as const

export const ROUTES = { api: API_ROUTES, pages: PAGE_ROUTES } as const
