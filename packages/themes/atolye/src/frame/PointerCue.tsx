"use client"

import { useEffect } from "react"

/** On `<html>` while the visitor's last move was a press (mouse, finger, pen). */
export const POINTER = "data-js-pointer"

/**
 * Tells the stylesheet how the focus came: `<html>` carries
 * `data-js-pointer` from a press until the next Tab, so a field the
 * visitor clicked keeps no frame (`search-fields.css`), while a keyboard
 * visitor's focus ring shows as always. The browser's own `:focus-visible`
 * answers this for a text field, not for a drop-down: a clicked `select`
 * matches it, and its frame stayed after the click (owner 2026-11-26).
 * Without the script nothing is marked and every ring shows.
 */
export function PointerCue() {
  useEffect(() => {
    const root = document.documentElement
    const press = () => {
      root.setAttribute(POINTER, "")
    }
    // Tab moves the focus from the keyboard: typing in a clicked field does not
    const key = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        root.removeAttribute(POINTER)
      }
    }
    document.addEventListener("pointerdown", press, true)
    document.addEventListener("keydown", key, true)
    return () => {
      document.removeEventListener("pointerdown", press, true)
      document.removeEventListener("keydown", key, true)
      root.removeAttribute(POINTER)
    }
  }, [])
  return null
}
