import { useCallback, useState } from 'react'

/** Start collapsed on every dashboard load; keep manual toggles during in-app navigation. */
export function useSidebar() {
  const [expanded, setExpanded] = useState(false)

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return { expanded, toggle }
}
