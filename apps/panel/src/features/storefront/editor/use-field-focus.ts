import { createContext, useContext, useEffect } from "react"

/**
 * A field picked by the settings search or by an edit label in the live
 * preview: its element, and a fresh number for each pick. A slide's field
 * (Faz 2b) names the slide too: its dialog opens at the element.
 */
export interface FieldFocus {
  target: string
  nonce: number
  slide?: number
}

const HIGHLIGHT_MS = 2400
const FOCUSABLE = '[role="radio"], input, textarea, button[role="switch"], button'

/**
 * Brings the field picked into view (adr/0049 Ek 2026-11-14 §6: the hit
 * opens the field and marks it; adr/0065 §9: so does the preview's edit
 * label): scrolled to the middle of its column (at once when the system
 * asks for less motion), its control focused, marked (`data-highlight`)
 * for a moment. Runs after the group holding it opened. A slide's field
 * is its dialog's to show (`useSlideFocus`).
 */
export function useFieldFocus(focus: FieldFocus | null) {
  useEffect(() => {
    if (!focus || focus.slide !== undefined) {
      return
    }
    const element = document.getElementById(focus.target)
    return element ? showField(element) : undefined
  }, [focus])
}

/**
 * What takes the focus for a field: the element itself if it can, else
 * the choice picked in it (a radio group's, a row of steps'), else its
 * first control.
 */
function focusIn(element: HTMLElement): HTMLElement | null {
  if (element.matches(FOCUSABLE) || element.tabIndex >= 0) {
    return element
  }
  return (
    element.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [data-state="on"]') ??
    element.querySelector<HTMLElement>(FOCUSABLE)
  )
}

/**
 * Scrolls a field into view, focuses its control and marks it for a
 * moment; the returned function takes the mark off at once. `control`:
 * the element to focus when it is not the field's first focusable one (a
 * hit of the panel's own search names it).
 */
export function showField(element: HTMLElement, control?: HTMLElement | null): () => void {
  // jsdom has no media queries: a test scrolls at once
  const still =
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  element.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" })
  focusIn(control ?? element)?.focus({ preventScroll: true })
  element.setAttribute("data-highlight", "")
  const timer = window.setTimeout(() => {
    element.removeAttribute("data-highlight")
  }, HIGHLIGHT_MS)
  return () => {
    window.clearTimeout(timer)
    element.removeAttribute("data-highlight")
  }
}

/** The field the open section's panel was asked to show, for a part that opens a dialog. */
export const FieldFocusContext = createContext<FieldFocus | null>(null)

/**
 * A slide list's side of a picked field (Faz 2b): each new pick naming
 * one of its slides opens that slide's dialog (`open`) with the element
 * to take the first focus (its `initialFocus`).
 */
export function useSlideFocus(open: (slide: number, target: string) => void) {
  const focus = useContext(FieldFocusContext)
  useEffect(() => {
    if (focus?.slide !== undefined) {
      open(focus.slide, focus.target)
    }
    // A new pick only: `open` sets the list's own state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])
}
