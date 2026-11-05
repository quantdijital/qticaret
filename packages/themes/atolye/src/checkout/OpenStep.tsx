"use client"

import { useEffect, useRef } from "react"

/**
 * A step after the first opens in sight: the page comes back from the
 * step before at its top, so the open step is scrolled to once (no
 * motion), its form and button under the thumb. A phone always goes
 * there; a wider screen only when the step would end below the window
 * (a short laptop, 1366×768 or 1440×800, the button under the fold),
 * otherwise it is left where it is, every step in sight.
 */
export function OpenStep({ first }: { first: boolean }) {
  const mark = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const step = mark.current?.closest("section")
    if (first || !step) {
      return
    }
    const phone = window.matchMedia("(max-width: 63.99rem)").matches
    if (phone || step.getBoundingClientRect().bottom > window.innerHeight) {
      step.scrollIntoView({ block: "start" })
    }
  }, [first])
  return <span ref={mark} hidden />
}
