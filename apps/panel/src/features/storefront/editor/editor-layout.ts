import { createContext, useSyncExternalStore } from "react"

/**
 * How much of the editor fits side by side (the owner, 2026-11-03: the
 * editor was cramped): the page's parts, a part's settings and the preview
 * from 1280 px; the settings and the preview from 1024 px, the parts in a
 * drawer; one at a time below, switched from the top bar.
 */
export type EditorLayout = "wide" | "medium" | "narrow"

/** What the narrow editor shows: the settings or the preview. */
export type EditorView = "edit" | "preview"

// Tailwind's xl and lg: the widths the rest of the panel steps at
const WIDE = "(min-width: 1280px)"
const MEDIUM = "(min-width: 1024px)"

const media = (query: string): MediaQueryList | null =>
  typeof window.matchMedia === "function" ? window.matchMedia(query) : null

const subscribe = (onChange: () => void) => {
  const lists = [media(WIDE), media(MEDIUM)].filter((list) => list !== null)
  for (const list of lists) {
    list.addEventListener("change", onChange)
  }
  return () => {
    for (const list of lists) {
      list.removeEventListener("change", onChange)
    }
  }
}

/** The layout for the window now; without media queries (a test's DOM) the full one. */
export function editorLayoutNow(): EditorLayout {
  const wide = media(WIDE)
  const medium = media(MEDIUM)
  if (!wide || !medium) {
    return "wide"
  }
  return wide.matches ? "wide" : medium.matches ? "medium" : "narrow"
}

/** The editor's layout, following the window as it is resized. */
export function useEditorLayout(): EditorLayout {
  return useSyncExternalStore(subscribe, editorLayoutNow, () => "wide")
}

/**
 * What a settings panel's header offers to reach the page's parts: going
 * back to the list beside it, or, where the list is in a drawer, opening it.
 */
export interface EditorChrome {
  openSections: (() => void) | null
}

export const EditorChromeContext = createContext<EditorChrome>({ openSections: null })

/** The section whose settings are open: its row in the list is marked. */
export const OpenedSectionContext = createContext<string | null>(null)
