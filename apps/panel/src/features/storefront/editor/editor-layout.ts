import { createContext, useSyncExternalStore } from "react"

/**
 * How much of the editor fits side by side (the owner, 2026-11-03: the
 * editor was cramped; 2026-11-27: one side panel, not two): from 1024 px
 * the side panel and the preview side by side, the same on a laptop and a
 * wide screen; one at a time below, switched from the top bar.
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
 * Where a settings panel's way back leads (the owner, 2026-11-27: one side
 * panel whose content swaps, as Shopify's): the page's parts, named as the
 * first step of the panel's breadcrumb.
 */
export interface EditorChrome {
  /** The page whose parts the list shows ("Ana sayfa"). */
  root: string
  /** Back to the page's parts. */
  toList: () => void
}

export const EditorChromeContext = createContext<EditorChrome>({
  root: "",
  toList: () => undefined,
})

/** The section whose settings are open, or were last: its row in the list is marked. */
export const OpenedSectionContext = createContext<string | null>(null)

/**
 * The section pointed at (adr/0065 Faz 2): in the preview, its row lights
 * up; over a row, the preview frames its section.
 */
export interface SectionHover {
  hovered: string | null
  hover: (id: string | null) => void
}

export const SectionHoverContext = createContext<SectionHover>({
  hovered: null,
  hover: () => undefined,
})
