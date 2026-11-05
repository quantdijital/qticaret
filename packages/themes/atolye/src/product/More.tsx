"use client"

import { ChevronDown } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { PAGE } from "./ReviewList"

/**
 * A ruled list whose rows past the first five wait for "Daha fazla …
 * göster", five more a press (`.gf-later` in `tabs.css`: without the
 * script every row shows and the button is not drawn). The rows are the
 * server's, in the first HTML.
 */
export function MoreList({ rows, more }: { rows: ReactNode[]; more: string }) {
  const [shown, setShown] = useState(PAGE)
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {rows.map((row, index) => (
          <li
            key={String(index)}
            data-later={index >= shown ? "" : undefined}
            className="gf-later flex flex-col gap-3 border-b border-rule py-6 first:pt-0 last:border-b-0"
          >
            {row}
          </li>
        ))}
      </ul>
      {rows.length > shown && (
        <button
          type="button"
          onClick={() => {
            setShown(shown + PAGE)
          }}
          className="gf-later-toggle gf-btn gf-btn--quiet gf-btn--small self-start"
        >
          {more}
          <ChevronDown className="size-4" aria-hidden="true" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
