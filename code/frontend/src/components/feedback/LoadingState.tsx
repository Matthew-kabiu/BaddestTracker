import { Spinner } from '@/components/kit/spinner'

interface LoadingStateProps {
  label?: string
  /** Fill the whole viewport (route-level loading) instead of the parent box. */
  fullScreen?: boolean
}

/** Spinner + label, built from the kit Spinner. */
export function LoadingState({ label = 'Loading…', fullScreen = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full items-center justify-center gap-2 text-fg-muted ${
        fullScreen ? 'min-h-dvh bg-canvas' : 'p-8'
      }`}
    >
      <Spinner aria-hidden="true" className="size-[1.4em] motion-reduce:animate-none" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
