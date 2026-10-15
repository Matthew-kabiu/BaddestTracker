import { Construction } from 'lucide-react'
import { useLocation } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { NAV_ITEMS } from '@/components/layout/nav'

/** Stand-in for modules whose pages haven't been built yet, so navigation never dead-ends. */
export default function ModulePlaceholder() {
  const { pathname } = useLocation()
  const item = NAV_ITEMS.find((n) => n.href === pathname)

  return (
    <EmptyState
      icon={item?.icon ?? Construction}
      title={`${item?.label ?? 'This module'} is on the way`}
      description="This part of Baddest Tracker hasn't been built yet."
    />
  )
}
