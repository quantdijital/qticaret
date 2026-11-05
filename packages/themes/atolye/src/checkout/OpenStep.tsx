"use client"

import { useEffect, useRef } from "react"

/**
 * On a phone, a step after the first opens in sight: the page comes back
 * from the step before at its top, so the open step is scrolled to once
 * (no motion), its form and button under the thumb. A desktop sees every
 * step at once and is left where it is.
 */
export function OpenStep({ first }: { first: boolean }) {
  const mark = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (first || !window.matchMedia("(max-width: 63.99rem)").matches) {
      return
    }
    mark.current?.closest("section")?.scrollIntoView({ block: "start" })
  }, [first])
  return <span ref={mark} hidden />
}
