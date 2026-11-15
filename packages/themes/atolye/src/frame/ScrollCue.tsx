"use client"

import { useEffect } from "react"

/** From this width the aisle folds behind the header's top row; under it the top row folds away. */
const WIDE = "(min-width: 64rem)"
/** How far the page moves down before the header folds, and up before it opens again (px). */
const FOLD_AFTER = 12
const OPEN_AFTER = 24

type Way = "top" | "down" | "up"

/** A sticky bar's top as laid out, without the transform it carries now. */
function laidOutTop(bar: HTMLElement, style: CSSStyleDeclaration): number {
  const shift = style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m42
  return bar.getBoundingClientRect().top - shift
}

/**
 * Tells the stylesheet which way the page scrolls (`frame.css`): on
 * `<html>`, `data-js-scroll` is "down" once the visitor scrolls down
 * past the header and "up" when they turn back; none near the top. It
 * also gives the header's height (`--gf-head-h`) and the part that folds
 * (`--gf-head-fold`: the aisle from 1024 px, the catalog header's strip
 * above it (whose rows below stay put), the top row on a phone),
 * and marks a listing's sticky bar `data-js-stuck` while it is pinned under
 * the header. Only attributes and custom properties change; the
 * stylesheet moves things by transform, so nothing shifts the layout.
 */
export function ScrollCue() {
  useEffect(() => {
    const root = document.documentElement
    const head = document.querySelector<HTMLElement>("[data-gf-head]")
    const wide = window.matchMedia(WIDE)
    let start = Number.POSITIVE_INFINITY
    let way: Way = "top"
    let last = Math.max(0, window.scrollY)
    let moved = 0
    let frame = 0

    const go = (next: Way) => {
      if (next === way) {
        return
      }
      way = next
      if (next === "top") {
        delete root.dataset["jsScroll"]
      } else {
        root.dataset["jsScroll"] = next
      }
    }

    const measure = () => {
      const sticky = head !== null && getComputedStyle(head).position === "sticky"
      const height = sticky ? head.offsetHeight : 0
      const part = head?.querySelector<HTMLElement>(
        wide.matches ? "[data-gf-aisle], [data-gf-strip]" : "[data-gf-head-row]"
      )
      root.style.setProperty("--gf-head-h", `${String(height)}px`)
      root.style.setProperty(
        "--gf-head-fold",
        `${String(sticky && part ? part.offsetHeight : 0)}px`
      )
      // The header folds only once its own place on the page has scrolled away
      const above = head?.previousElementSibling
      const bar =
        above instanceof HTMLElement && !above.matches(".gf-skip") ? above.offsetHeight : 0
      start = sticky ? bar + height : Number.POSITIVE_INFINITY
    }

    const stick = () => {
      for (const bar of document.querySelectorAll<HTMLElement>("[data-gf-stick]")) {
        const style = getComputedStyle(bar)
        const pinned =
          style.position === "sticky" &&
          laidOutTop(bar, style) <= Number.parseFloat(style.top || "0") + 1
        bar.toggleAttribute("data-js-stuck", pinned)
      }
    }

    const update = () => {
      frame = 0
      const end = Math.max(0, root.scrollHeight - window.innerHeight)
      // iOS bounces past both ends; a bounce is not a turn
      const y = Math.min(Math.max(0, window.scrollY), end)
      const step = y - last
      last = y
      if (y <= start) {
        moved = 0
        go("top")
      } else if (step !== 0) {
        moved = Math.sign(step) === Math.sign(moved) ? moved + step : step
        if (moved > FOLD_AFTER) {
          go("down")
        } else if (moved < -OPEN_AFTER) {
          go("up")
        }
      }
      stick()
    }

    const schedule = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update)
      }
    }
    const remeasure = () => {
      measure()
      schedule()
    }

    measure()
    update()
    const sized = new ResizeObserver(remeasure)
    if (head) {
      sized.observe(head)
    }
    window.addEventListener("scroll", schedule, { passive: true })
    wide.addEventListener("change", remeasure)
    return () => {
      window.removeEventListener("scroll", schedule)
      wide.removeEventListener("change", remeasure)
      sized.disconnect()
      window.cancelAnimationFrame(frame)
      delete root.dataset["jsScroll"]
    }
  }, [])
  return null
}
