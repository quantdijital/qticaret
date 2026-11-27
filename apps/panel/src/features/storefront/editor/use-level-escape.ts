import { useEffect, useEffectEvent } from "react"

// Something above the side panel answers Escape itself: a dialog, a menu, an open list
const LAYERS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/** Whether Escape is the side panel's to take, rather than a field's or a layer's. */
export function escapeGoesUp(event: KeyboardEvent): boolean {
  // Browser autofill fires keydown events without a key
  if (event.key !== "Escape" || event.defaultPrevented) {
    return false
  }
  // A word being composed (an input method) takes Escape to cancel it
  if (event.isComposing) {
    return false
  }
  const target = event.target
  // A search box with a query clears it first
  if (target instanceof HTMLInputElement && target.type === "search" && target.value !== "") {
    return false
  }
  if (target instanceof Element && target.closest(LAYERS)) {
    return false
  }
  return document.querySelector(LAYERS) === null
}

/**
 * Escape takes the side panel up one step (a footer row to the footer,
 * a section to the page's parts) while `up` is given: never while a
 * dialog, a menu or an open list is on screen, nor while a word is being
 * composed.
 */
export function useLevelEscape(up: (() => void) | null) {
  const active = up !== null
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (up && escapeGoesUp(event)) {
      event.preventDefault()
      up()
    }
  })
  useEffect(() => {
    if (!active) {
      return undefined
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [active])
}
