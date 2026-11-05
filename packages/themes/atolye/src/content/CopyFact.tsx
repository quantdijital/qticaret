"use client"

import { Check, Copy } from "lucide-react"
import { useCopy } from "../parts/useCopy"

/**
 * One of the imprint's numbers to the clipboard (the MERSİS number, the
 * tax number, the KEP address): a small round copy button right after
 * the value, its 44 px target spilling into the row's gaps so the row
 * stays one line high. Its name says what it copies ("MERSİS numarasını
 * kopyala"); once copied a tick for a moment, "Kopyalandı" read out
 * beside it. Drawn only with the script and a clipboard to write to.
 */
export function CopyFact({
  value,
  label,
  copiedWord,
}: {
  value: string
  label: string
  copiedWord: string
}) {
  const { available, copied, copy } = useCopy(value)
  if (!available) {
    return null
  }
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        title={label}
        className="gf-icon-btn -my-2.5 shrink-0 text-text-2 hover:bg-paper-3 hover:text-text"
      >
        {copied ? (
          <Check className="size-4 text-ok" aria-hidden="true" strokeWidth={2.5} />
        ) : (
          <Copy className="size-4" aria-hidden="true" strokeWidth={2} />
        )}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? copiedWord : ""}
      </span>
    </>
  )
}
