"use client"

import { ChevronDown, Tag } from "lucide-react"
import { useState } from "react"
import type { FormAction } from "@qticaret/ui"
import { CodeForm } from "../cart/CodeForm"
import type { CodeWords } from "../cart/CodeForm"

/**
 * The checkout's code field in its order summary (D6): one quiet closed
 * line, "İndirim kodu", so the steps keep the eye; open from the start
 * when the cart already holds a code. Inside, the cart page's own field
 * and chips. Once the shopper opens or closes it, it stays so while the
 * totals are drawn again: the last code taken off does not fold it away
 * under the hand.
 */
export function SummaryCode({
  id,
  codes,
  apply,
  remove,
  words,
}: {
  id: string
  codes: readonly string[]
  apply: FormAction
  remove: (form: FormData) => Promise<void>
  words: CodeWords
}) {
  const [open, setOpen] = useState(codes.length > 0)
  return (
    <details
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open)
      }}
      className="group/code border-t border-stage-rule pt-2"
    >
      <summary className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold">
        <Tag className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
        <span className="flex-1">{words.label}</span>
        <ChevronDown
          className="size-4.5 shrink-0 transition-transform duration-(--dur-short) group-open/code:rotate-180"
          aria-hidden="true"
          strokeWidth={2}
        />
      </summary>
      <div className="pt-2 pb-1">
        <CodeForm id={id} codes={codes} apply={apply} remove={remove} words={words} labelHidden />
      </div>
    </details>
  )
}
