"use client"

import { Check, Copy } from "lucide-react"
import { useCopy } from "../parts/useCopy"

/**
 * The transfer's IBAN to the clipboard in one press (selecting 26 digits
 * by a thumb is the hard part of paying by transfer on a phone): a quiet
 * small pill; once copied it says so for a moment, in words a reader hears
 * too. Its name says what it copies ("IBAN'ı kopyala"), its face only
 * "Kopyala" beside the number. Drawn only with the script and a clipboard
 * to write to; the IBAN itself stays selectable beside it.
 */
export function CopyIban({
  iban,
  words,
}: {
  iban: string
  words: { copy: string; label: string; copied: string }
}) {
  const { available, copied, copy } = useCopy(iban)
  if (!available) {
    return null
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? words.copied : words.label}
      className="gf-btn gf-btn--quiet gf-btn--small self-start"
    >
      {copied ? (
        <Check className="size-4 text-ok" aria-hidden="true" strokeWidth={2.5} />
      ) : (
        <Copy className="size-4" aria-hidden="true" strokeWidth={2} />
      )}
      <span aria-live="polite">{copied ? words.copied : words.copy}</span>
    </button>
  )
}
