/** Mirrors the backend `events::Kind`, plus `resync` when the stream missed events. */
export type LiveEventType =
  | 'todo.created'
  | 'todo.updated'
  | 'todo.deleted'
  | 'note.created'
  | 'note.updated'
  | 'note.deleted'
  | 'shopping.created'
  | 'shopping.updated'
  | 'shopping.deleted'
  | 'budget.created'
  | 'budget.updated'
  | 'budget.deleted'
  | 'expense.created'
  | 'expense.updated'
  | 'expense.deleted'
  | 'calendar.created'
  | 'calendar.updated'
  | 'calendar.deleted'
  | 'vault.created'
  | 'vault.updated'
  | 'vault.deleted'
  | 'notification.created'
  | 'notification.updated'
  | 'notification.deleted'
  | 'resync'

/** Ids only: listeners refetch, the stream never carries data. */
export interface LiveEvent {
  type: LiveEventType
  id?: string
  /** The tab that made the change; null when it was not a browser tab. */
  origin?: string | null
}

export type LiveEventListener = (event: LiveEvent) => void
