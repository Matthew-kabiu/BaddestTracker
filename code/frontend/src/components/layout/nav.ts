import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  NotebookPen,
  ShoppingCart,
  Sparkles,
  Wallet,
} from 'lucide-react'

import { PAGE_ROUTES } from '@/lib/routes'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  description: string
}

/** Dashboard navigation — one config array drives the sidebar and the dashboard home. */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', href: PAGE_ROUTES.dashboard.root, icon: LayoutDashboard, description: 'Everything at a glance' },
  { label: 'To-do', href: PAGE_ROUTES.dashboard.todos, icon: ListTodo, description: 'Tasks and checklists' },
  { label: 'Notes', href: PAGE_ROUTES.dashboard.notes, icon: NotebookPen, description: 'Write things down' },
  { label: 'Shopping', href: PAGE_ROUTES.dashboard.shopping, icon: ShoppingCart, description: 'Lists for the shops' },
  { label: 'Budget', href: PAGE_ROUTES.dashboard.budget, icon: Wallet, description: 'Spending and categories' },
  { label: 'Calendar', href: PAGE_ROUTES.dashboard.calendar, icon: CalendarDays, description: 'Events and reminders' },
  { label: 'Vault', href: PAGE_ROUTES.dashboard.vault, icon: KeyRound, description: 'Encrypted passwords' },
  { label: 'AI', href: PAGE_ROUTES.dashboard.ai, icon: Sparkles, description: 'Ask about your data' },
]
