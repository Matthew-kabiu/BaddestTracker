import { Copy, Download } from 'lucide-react'

import { notify } from '@/components/feedback/toast'
import { Button } from '@/components/kit/button'

/** The one-time display of the recovery code, with copy and download. */
export function RecoveryCode({ code }: { code: string }) {
  function download() {
    const blob = new Blob(
      [`Baddest Tracker vault recovery key\n\n${code}\n\nKeep this somewhere safe. It is the only way back in if you forget your master password.\n`],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'baddest-tracker-recovery-key.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg border border-line-strong bg-muted p-4 text-center font-mono text-sm tracking-wide break-all text-fg select-all">
        {code}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            navigator.clipboard.writeText(code).then(
              () => notify.success('Recovery key copied.'),
              () => notify.error(null, "We couldn't copy it. Select it and copy instead."),
            )
          }
        >
          <Copy aria-hidden="true" />
          Copy
        </Button>
        <Button variant="outline" onClick={download}>
          <Download aria-hidden="true" />
          Download
        </Button>
      </div>
    </div>
  )
}
