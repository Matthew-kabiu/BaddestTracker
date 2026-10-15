import { mapErrorToMessage } from '@/lib/api/errorMap'
import { CLIENT_ID } from '@/lib/events/client-id'
import type { VaultKeyRecord } from '@/lib/vault/crypto'
import { ROUTES } from '@/lib/routes'
import type {
  AiKeySummary,
  AiProvider,
  ApiEnvelope,
  Budget,
  BudgetSummary,
  CalendarEvent,
  CreateEventDTO,
  Occurrence,
  UpdateEventDTO,
  CreateBudgetDTO,
  CreateExpenseDTO,
  CreateShoppingItemDTO,
  Expense,
  Inbox,
  AppNotification,
  ShoppingItem,
  TelegramStatus,
  VaultItemBlob,
  UpdateBudgetDTO,
  UpdateExpenseDTO,
  UpdateShoppingItemDTO,
  ChatRequestDTO,
  ChatResponse,
  CreateNoteDTO,
  CreateTodoDTO,
  Health,
  Note,
  PutAiKeyDTO,
  Todo,
  UpdateNoteDTO,
  UpdateTodoDTO,
} from '@/types/api'

const REQUEST_TIMEOUT_MS = 30_000

/** The only error type UIs handle. `userMessage` is safe to show; nothing else is. */
export class ApiClientError extends Error {
  readonly userMessage: string
  readonly code: string
  readonly statusCode: number

  constructor(userMessage: string, code: string, statusCode: number) {
    super(userMessage)
    this.name = 'ApiClientError'
    this.userMessage = userMessage
    this.code = code
    this.statusCode = statusCode
  }
}

/** Singleton — every backend call goes through here. Components never call fetch. */
class ApiClient {
  private static instance: ApiClient | undefined

  private constructor() {}

  static getInstance(): ApiClient {
    ApiClient.instance ??= new ApiClient()
    return ApiClient.instance
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        credentials: 'include', // httpOnly session cookie — never tokens in storage
        // X-Client-Id lets this tab recognise its own live events (see lib/events).
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID, ...init.headers },
      })
      if (res.status === 204) return undefined as T

      const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null
      if (!res.ok || !body || !body.success) {
        const code = body && !body.success ? body.error : 'UNKNOWN_ERROR'
        if (import.meta.env.DEV) console.error('[apiClient]', res.status, code, body)
        throw new ApiClientError(mapErrorToMessage(code, res.status), code, res.status)
      }
      return body.data
    } catch (err) {
      if (err instanceof ApiClientError) throw err
      const code = err instanceof DOMException && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
      throw new ApiClientError(mapErrorToMessage(code, 0), code, 0)
    } finally {
      clearTimeout(timeout)
    }
  }

  private get = <T>(url: string) => this.request<T>(url)
  private post = <T>(url: string, data?: unknown) =>
    this.request<T>(url, { method: 'POST', body: JSON.stringify(data) })
  private put = <T>(url: string, data?: unknown) =>
    this.request<T>(url, { method: 'PUT', body: JSON.stringify(data) })
  private patch = <T>(url: string, data?: unknown) =>
    this.request<T>(url, { method: 'PATCH', body: JSON.stringify(data) })
  private delete = <T>(url: string) => this.request<T>(url, { method: 'DELETE' })

  /* ─── Public surface — mirrors API_ROUTES ─── */

  health = () => this.get<Health>(ROUTES.api.health)

  todos = {
    list: () => this.get<Todo[]>(ROUTES.api.todos.list),
    create: (dto: CreateTodoDTO) => this.post<Todo>(ROUTES.api.todos.create, dto),
    update: (id: string, dto: UpdateTodoDTO) => this.patch<Todo>(ROUTES.api.todos.byId(id), dto),
    remove: (id: string) => this.delete<void>(ROUTES.api.todos.byId(id)),
  }

  notes = {
    list: () => this.get<Note[]>(ROUTES.api.notes.list),
    create: (dto: CreateNoteDTO) => this.post<Note>(ROUTES.api.notes.create, dto),
    update: (id: string, dto: UpdateNoteDTO) => this.patch<Note>(ROUTES.api.notes.byId(id), dto),
    remove: (id: string) => this.delete<void>(ROUTES.api.notes.byId(id)),
  }

  shopping = {
    list: () => this.get<ShoppingItem[]>(ROUTES.api.shopping.list),
    create: (dto: CreateShoppingItemDTO) => this.post<ShoppingItem>(ROUTES.api.shopping.create, dto),
    update: (id: string, dto: UpdateShoppingItemDTO) =>
      this.patch<ShoppingItem>(ROUTES.api.shopping.byId(id), dto),
    remove: (id: string) => this.delete<void>(ROUTES.api.shopping.byId(id)),
  }

  budgets = {
    list: (on: string) => this.get<BudgetSummary[]>(ROUTES.api.budgets.list(on)),
    create: (dto: CreateBudgetDTO) => this.post<Budget>(ROUTES.api.budgets.create, dto),
    update: (id: string, dto: UpdateBudgetDTO) => this.patch<Budget>(ROUTES.api.budgets.byId(id), dto),
    remove: (id: string) => this.delete<void>(ROUTES.api.budgets.byId(id)),
  }

  expenses = {
    list: (from: string, to: string) => this.get<Expense[]>(ROUTES.api.expenses.list(from, to)),
    create: (dto: CreateExpenseDTO) => this.post<Expense>(ROUTES.api.expenses.create, dto),
    update: (id: string, dto: UpdateExpenseDTO) => this.patch<Expense>(ROUTES.api.expenses.byId(id), dto),
    remove: (id: string) => this.delete<void>(ROUTES.api.expenses.byId(id)),
  }

  calendar = {
    list: (from: string, to: string) => this.get<Occurrence[]>(ROUTES.api.calendar.list(from, to)),
    get: (id: string) => this.get<CalendarEvent>(ROUTES.api.calendar.byId(id)),
    create: (dto: CreateEventDTO) => this.post<CalendarEvent>(ROUTES.api.calendar.create, dto),
    update: (id: string, dto: UpdateEventDTO) => this.patch<CalendarEvent>(ROUTES.api.calendar.byId(id), dto),
    remove: (id: string) => this.delete<void>(ROUTES.api.calendar.byId(id)),
  }

  /** Blobs only: everything is encrypted and decrypted in lib/vault/crypto.ts. */
  vault = {
    getKey: () => this.get<VaultKeyRecord | null>(ROUTES.api.vault.key),
    putKey: (record: VaultKeyRecord) => this.put<VaultKeyRecord>(ROUTES.api.vault.key, record),
    wipe: () => this.delete<void>(ROUTES.api.vault.root),
    items: () => this.get<VaultItemBlob[]>(ROUTES.api.vault.items),
    create: (blob: { id: string; ciphertext: string; nonce: string }) =>
      this.post<VaultItemBlob>(ROUTES.api.vault.items, blob),
    update: (id: string, blob: { ciphertext: string; nonce: string }) =>
      this.put<VaultItemBlob>(ROUTES.api.vault.itemById(id), blob),
    remove: (id: string) => this.delete<void>(ROUTES.api.vault.itemById(id)),
  }

  telegram = {
    status: () => this.get<TelegramStatus>(ROUTES.api.telegram.status),
    setBot: (botToken: string) => this.put<TelegramStatus>(ROUTES.api.telegram.status, { botToken }),
    confirm: () => this.post<TelegramStatus>(ROUTES.api.telegram.confirm),
    test: () => this.post<void>(ROUTES.api.telegram.test),
    disconnect: () => this.delete<void>(ROUTES.api.telegram.status),
  }

  notifications = {
    list: () => this.get<Inbox>(ROUTES.api.notifications.list),
    setRead: (id: string, read: boolean) =>
      this.patch<AppNotification>(ROUTES.api.notifications.byId(id), { read }),
    readAll: () => this.post<void>(ROUTES.api.notifications.readAll),
    remove: (id: string) => this.delete<void>(ROUTES.api.notifications.byId(id)),
  }

  ai = {
    listKeys: () => this.get<AiKeySummary[]>(ROUTES.api.ai.keys),
    putKey: (provider: AiProvider, dto: PutAiKeyDTO) =>
      this.put<AiKeySummary>(ROUTES.api.ai.keyByProvider(provider), dto),
    removeKey: (provider: AiProvider) => this.delete<void>(ROUTES.api.ai.keyByProvider(provider)),
    chat: (dto: ChatRequestDTO) => this.post<ChatResponse>(ROUTES.api.ai.chat, dto),
  }
}

export const apiClient = ApiClient.getInstance()
