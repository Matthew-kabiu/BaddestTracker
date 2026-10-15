/** Backend response envelope (identical across the Rust/Node/Go templates). */
export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
}

export interface ApiFailure {
  success: false
  error: string
  message: string
  statusCode: number
  timestamp: string
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export interface Health {
  status: string
  database: string
}

// Domain DTOs — provisional until the backend modules land (#253, #255). Align with the
// backend's model.rs when they do.
export interface Todo {
  id: string
  title: string
  done: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTodoDTO {
  title: string
}

export interface UpdateTodoDTO {
  title?: string
  done?: boolean
}

export interface Note {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export interface CreateNoteDTO {
  title: string
  body: string
}

export type UpdateNoteDTO = Partial<CreateNoteDTO>

export type AiProvider = 'anthropic' | 'openai' | 'openrouter' | 'gemini'

export interface AiKeySummary {
  provider: AiProvider
  model: string
  updatedAt: string
}

export interface PutAiKeyDTO {
  apiKey: string
  model: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequestDTO {
  provider: AiProvider
  model: string
  messages: ChatMessage[]
}

export interface ChatResponse {
  message: ChatMessage
}

/* ─── Shopping (backend src/shopping/model.rs) ─── */

export interface ShoppingItem {
  id: string
  name: string
  quantity: number
  /** Minor units (cents); null = no price yet. */
  unitPriceCents: number | null
  /** Buyer's local date (YYYY-MM-DD); null = still to buy. */
  boughtOn: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateShoppingItemDTO {
  name: string
  quantity?: number
  unitPriceCents?: number | null
}

/** For nullable fields, null clears and absent leaves alone. */
export interface UpdateShoppingItemDTO {
  name?: string
  quantity?: number
  unitPriceCents?: number | null
  boughtOn?: string | null
}

/* ─── Budget (backend src/budget/model.rs) ─── */

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface Budget {
  id: string
  name: string
  amountCents: number
  period: BudgetPeriod
  customStart: string | null
  customEnd: string | null
  includesShopping: boolean
  createdAt: string
  updatedAt: string
}

/** A budget with the period window containing "today" and what has been spent in it. */
export interface BudgetSummary extends Budget {
  window: { start: string; end: string }
  spentCents: number
}

export interface CreateBudgetDTO {
  name: string
  amountCents: number
  period: BudgetPeriod
  customStart?: string
  customEnd?: string
  includesShopping?: boolean
}

export interface UpdateBudgetDTO {
  name?: string
  amountCents?: number
  period?: BudgetPeriod
  customStart?: string | null
  customEnd?: string | null
  includesShopping?: boolean
}

export interface Expense {
  id: string
  budgetId: string | null
  amountCents: number
  description: string
  spentOn: string
  createdAt: string
  updatedAt: string
}

export interface CreateExpenseDTO {
  amountCents: number
  description?: string
  spentOn: string
  budgetId?: string | null
}

export interface UpdateExpenseDTO {
  amountCents?: number
  description?: string
  spentOn?: string
  budgetId?: string | null
}

/* ─── Notifications (backend src/notification/model.rs) ─── */

export interface AppNotification {
  id: string
  /** e.g. `budget.exceeded`; picks the icon. */
  kind: string
  title: string
  body: string
  /** In-app route to open. */
  link: string | null
  readAt: string | null
  createdAt: string
}

export interface Inbox {
  items: AppNotification[]
  unreadCount: number
}

/* ─── Calendar (backend src/calendar/model.rs) ─── */

export type RepeatFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Repeat {
  freq: RepeatFreq
  /** Every N days / weeks / months / years. */
  interval: number
  /** Last day an occurrence may start (YYYY-MM-DD). At most one of until / count. */
  until: string | null
  count: number | null
}

/** A series as stored. Local times ("YYYY-MM-DDTHH:MM:SS") are in `timezone`. */
export interface CalendarEvent {
  id: string
  title: string
  notes: string
  allDay: boolean
  start: string
  end: string
  timezone: string
  repeat: Repeat | null
  reminderMinutes: number | null
  createdAt: string
  updatedAt: string
}

/** One concrete occurrence of a series, for the calendar views. */
export interface Occurrence {
  eventId: string
  title: string
  notes: string
  allDay: boolean
  start: string
  end: string
  startsAt: string
  endsAt: string
  timezone: string
  repeats: boolean
  reminderMinutes: number | null
}

export interface CreateEventDTO {
  title: string
  notes?: string
  allDay: boolean
  start: string
  end: string
  timezone: string
  repeat?: Repeat | null
  reminderMinutes?: number | null
}

export type UpdateEventDTO = Partial<CreateEventDTO>

/* ─── Telegram (backend src/telegram/model.rs) ─── */

export interface TelegramStatus {
  configured: boolean
  botUsername: string | null
  linked: boolean
  /** Opens the bot with the one-time code; present until linked. */
  linkUrl: string | null
}

/* ─── Vault (backend src/vault/model.rs): opaque blobs, see lib/vault/crypto.ts ─── */

export interface VaultItemBlob {
  id: string
  ciphertext: string
  nonce: string
  createdAt: string
  updatedAt: string
}
