import { useEffect, useState } from "react"
import type { RefObject } from "react"

/**
 * Whether the element has come near the screen once: a card far down the
 * gallery asks for nothing until it is scrolled to. Without an observer
 * (an old browser) it counts as seen.
 */
export function useSeen(ref: RefObject<HTMLElement | null>, margin = "200px"): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver !== "function")
  useEffect(() => {
    const element = ref.current
    if (seen || !element) {
      return
    }
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true)
        }
      },
      { rootMargin: margin }
    )
    watcher.observe(element)
    return () => {
      watcher.disconnect()
    }
  }, [ref, seen, margin])
  return seen
}
