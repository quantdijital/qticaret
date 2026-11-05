"use client"

import { useEffect, useState } from "react"
import type { RefObject } from "react"

/**
 * Whether the element has scrolled away above the screen (the buy row,
 * for the phone's bar): read on scroll and resize, once a frame, not by
 * an observer: a jump past the row crosses nothing.
 */
export function useScrolledAway(element: RefObject<HTMLElement | null>): boolean {
  const [away, setAway] = useState(false)
  useEffect(() => {
    const target = element.current
    if (!target) {
      return
    }
    let frame = 0
    const measure = () => {
      frame = 0
      setAway(target.getBoundingClientRect().bottom < 0)
    }
    const schedule = () => {
      frame ||= window.requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [element])
  return away
}
