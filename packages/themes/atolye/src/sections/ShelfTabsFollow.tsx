"use client"

import { useEffect, useRef } from "react"

/** Below Tailwind's `lg:`, where the pill row scrolls with its fades (`tabs-rail.css`). */
const NARROW = "(width < 64rem)"
const REDUCED = "(prefers-reduced-motion: reduce)"

/**
 * Below 1024 px the shelf's pills stand on one line that scrolls sideways.
 * A pill reached by the arrow keys or Tab, or chosen by a press, scrolls
 * into view whole and clear of the row's fade: the browser on its own
 * leaves a pill that is partly in view where it is, cut. Without the
 * script the row still scrolls by touch and the pills still choose.
 */
export function ShelfTabsFollow() {
  const mark = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const row = mark.current?.closest(".gf-tabs")?.querySelector(".gf-tab-row")
    if (!row) {
      return
    }
    const follow = (event: Event) => {
      const radio = event.target
      if (!(radio instanceof HTMLInputElement) || !window.matchMedia(NARROW).matches) {
        return
      }
      // The radio covers its pill and keeps a fade's width clear (`scroll-margin`)
      radio.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: window.matchMedia(REDUCED).matches ? "auto" : "smooth",
      })
    }
    row.addEventListener("change", follow)
    row.addEventListener("focusin", follow)
    return () => {
      row.removeEventListener("change", follow)
      row.removeEventListener("focusin", follow)
    }
  }, [])
  return <span ref={mark} hidden />
}
