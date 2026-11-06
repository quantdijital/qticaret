import { useLayoutEffect, useState } from "react"
import type { RefObject } from "react"

/**
 * Whether an element, with `room` rem kept free around it (above it the
 * offset it sticks at, below a margin), fits in the window's height. It
 * is measured again whenever the element or the window changes size.
 * Until measured, where it cannot be (no ResizeObserver) and while not
 * `active`, it fits.
 */
export function useFitsView(
  ref: RefObject<HTMLElement | null>,
  room: number,
  active = true
): boolean {
  const [fits, setFits] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (!active || !el || typeof ResizeObserver !== "function") {
      setFits(true)
      return
    }
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      setFits(el.offsetHeight + room * rem <= window.innerHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [ref, room, active])
  return fits
}
