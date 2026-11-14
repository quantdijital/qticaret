import { useEffect } from "react"

/** A field the settings search picked: its element, and a fresh number for each pick. */
export interface FieldFocus {
  target: string
  nonce: number
}

const HIGHLIGHT_MS = 2400
const FOCUSABLE = '[role="radio"], input, textarea, button[role="switch"], button'

/**
 * Brings the field the settings search picked into view (adr/0049 Ek
 * 2026-11-14 §6: the hit opens the field and marks it): scrolled to the
 * middle of its column, its control focused, marked (`data-highlight`) for
 * a moment. Runs after the group holding it opened.
 */
export function useFieldFocus(focus: FieldFocus | null) {
  useEffect(() => {
    if (!focus) {
      return
    }
    const element = document.getElementById(focus.target)
    if (!element) {
      return
    }
    // jsdom has no media queries: a test scrolls at once
    const still =
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" })
    const control = element.matches(FOCUSABLE)
      ? element
      : element.querySelector<HTMLElement>(FOCUSABLE)
    control?.focus({ preventScroll: true })
    element.setAttribute("data-highlight", "")
    const timer = window.setTimeout(() => {
      element.removeAttribute("data-highlight")
    }, HIGHLIGHT_MS)
    return () => {
      window.clearTimeout(timer)
      element.removeAttribute("data-highlight")
    }
  }, [focus])
}
