import { useLayoutEffect } from "react"
import type { RefObject } from "react"

// Where the columns stand side by side (Tailwind `xl`); narrower, they stack and nothing sticks
const SIDE_BY_SIDE = "(min-width: 80rem)"

/** The room a sticky column keeps, in rem: `top` under the window's top, `gap` over its bottom. */
export interface StickyRoom {
  top: number
  gap: number
}

/**
 * A side column that follows the scroll both ways without ever scrolling
 * inside (`PageColumn sticky`). `body` is sticky in its grid cell `cell`,
 * held from above at `--sticky-top` and from below at `--sticky-bottom`,
 * so it is drawn no higher than `top` and, once taller than the window,
 * no lower than its bottom at the window's bottom less `gap`. Between the
 * two it moves with the page: a spacer (`--sticky-shift`) keeps its place
 * in the flow where it is drawn, so turning the scroll back moves it at
 * once instead of after the distance it was held. The browser does the
 * moving, the page only measures (scroll, resize, the column's size), so
 * nothing lags or jumps. The cell's own height leaves the row alone
 * (`--sticky-height`, CSS size containment): the spacer never stretches it.
 */
export function useTwoWaySticky(
  cell: RefObject<HTMLElement | null>,
  body: RefObject<HTMLElement | null>,
  room: StickyRoom,
  active = true
): void {
  const { top, gap } = room
  useLayoutEffect(() => {
    const box = cell.current
    const column = body.current
    if (
      !active ||
      !box ||
      !column ||
      typeof ResizeObserver !== "function" ||
      typeof window.matchMedia !== "function"
    ) {
      return
    }
    const wide = window.matchMedia(SIDE_BY_SIDE)
    let shift = 0
    const set = (name: string, px: number) => {
      box.style.setProperty(name, `${px}px`)
    }
    // Its place in the flow becomes where it is drawn: held by neither edge, it moves with the page
    const settle = () => {
      if (!wide.matches) {
        return
      }
      const at = column.getBoundingClientRect().top - box.getBoundingClientRect().top
      if (Math.abs(at - shift) > 0.5) {
        shift = Math.max(0, at)
        set("--sticky-shift", shift)
      }
    }
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const height = column.offsetHeight
      const view = window.innerHeight
      set("--sticky-height", height)
      set("--sticky-top", Math.min(top * rem, view - height - gap * rem))
      set("--sticky-bottom", view - top * rem - height)
      settle()
    }
    const turn = () => {
      shift = 0
      set("--sticky-shift", 0)
      measure()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    observer.observe(box)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", settle, { passive: true })
    wide.addEventListener("change", turn)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", settle)
      wide.removeEventListener("change", turn)
      for (const name of ["--sticky-height", "--sticky-top", "--sticky-bottom", "--sticky-shift"]) {
        box.style.removeProperty(name)
      }
    }
  }, [cell, body, top, gap, active])
}
