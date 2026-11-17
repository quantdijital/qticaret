import { useCallback, useEffect, useEffectEvent, useState } from "react"

/**
 * The editor's side panel (the owner, 2026-11-17: "to see it bigger"):
 * the page's parts and the open part's settings fold away and the
 * preview takes the whole width, as a design tool's ⌘\ hides its panels.
 * The choice is remembered in this browser; without storage it still
 * works. Picking a part while it is folded (in the preview, from the
 * chooser) brings it back, since its settings are what was asked for.
 * Below 1024 px the editor already shows one thing at a time, so the
 * choice does not apply there.
 */

/** The id the toggle names as what it controls. */
export const SIDEBAR_ID = "editor-sidebar"

const STORE = "qticaret.editor.sidebar.v1"

function readShown(): boolean {
  try {
    return window.localStorage.getItem(STORE) !== "hidden"
  } catch {
    return true
  }
}

function writeShown(shown: boolean) {
  try {
    if (shown) {
      window.localStorage.removeItem(STORE)
    } else {
      window.localStorage.setItem(STORE, "hidden")
    }
  } catch {
    // Storage off or full: the choice lasts until the page is left
  }
}

export interface EditorSidebar {
  shown: boolean
  toggle: () => void
  /** Shows it (a part asked for again while folded, say from the preview). */
  show: () => void
}

/**
 * Whether the side panel is shown; `formKey` is the open part's settings
 * (null for none): another part opened shows the panel again. `active`
 * is false where the choice does not apply (the narrow editor): ⌘\ /
 * Ctrl+\ does nothing there.
 */
export function useEditorSidebar(formKey: string | null, active: boolean): EditorSidebar {
  const [shown, setShown] = useState(readShown)
  const [seenKey, setSeenKey] = useState(formKey)
  if (seenKey !== formKey) {
    setSeenKey(formKey)
    if (formKey !== null && !shown) {
      setShown(true)
      writeShown(true)
    }
  }
  const toggle = useCallback(() => {
    setShown(!shown)
    writeShown(!shown)
  }, [shown])
  const show = useCallback(() => {
    setShown(true)
    writeShown(true)
  }, [])
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    // Browser autofill fires keydown events without a key
    if (!active || typeof event.key !== "string" || event.defaultPrevented) {
      return
    }
    if (event.key === "\\" && (event.metaKey || event.ctrlKey) && !event.altKey) {
      event.preventDefault()
      toggle()
    }
  })
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [])
  return { shown, toggle, show }
}
