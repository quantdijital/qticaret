import { BRIDGE_SECTION_ID, readToStorefront } from "@qticaret/types/editor-bridge"
import type { Reveal, ToStorefrontMessage } from "@qticaret/types/editor-bridge"

/**
 * The preview frame's side of the theme editor's bridge (adr/0065 §2, Faz
 * 1), as plain functions: which messages it takes, where a section is,
 * when to scroll, which keys go to the panel, and the one style it writes.
 * No directive: the client component and the tests both read it.
 */

interface Received {
  origin: string
  source: unknown
  data: unknown
}

/**
 * A message the frame acts on: from the panel's exact origin, sent by the
 * window framing it, shaped as the bridge's schema says (64 KB at most).
 * Anything else is null, never an error.
 */
export function acceptMessage(
  event: Received,
  panelOrigin: string,
  parent: unknown
): ToStorefrontMessage | null {
  if (!panelOrigin || event.origin !== panelOrigin || event.source !== parent || parent === null) {
    return null
  }
  return readToStorefront(event.data)
}

/** A section's element selector; null for an id that is not one (never interpolated unchecked). */
export function sectionSelector(id: string): string | null {
  return BRIDGE_SECTION_ID.test(id) ? `[data-qs="${id}"]` : null
}

/** Whether to scroll a section into view: always, never, or when no part of it shows. */
export function needsScroll(
  rect: { top: number; bottom: number },
  viewportHeight: number,
  reveal: Reveal
): boolean {
  if (reveal === "always") {
    return true
  }
  if (reveal === "never") {
    return false
  }
  return rect.bottom <= 0 || rect.top >= viewportHeight
}

interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  target: unknown
}

/** Whether a key goes to a field of the page being typed in. */
export const isEditable = (target: unknown): boolean => {
  if (typeof target !== "object" || target === null) {
    return false
  }
  const element = target as { tagName?: unknown; isContentEditable?: unknown }
  const tag = typeof element.tagName === "string" ? element.tagName.toUpperCase() : ""
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true
  )
}

/**
 * The editor's keys pressed while the frame has focus (adr/0065 §5): undo
 * and redo go to the panel's history, Escape gives focus back. A field of
 * the page being typed in keeps its own keys.
 */
export function editorKey(event: KeyLike): "undo" | "redo" | "escape" | null {
  if (isEditable(event.target)) {
    return null
  }
  if (event.key === "Escape" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return "escape"
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return null
  }
  const key = event.key.toLowerCase()
  if (key === "z") {
    return event.shiftKey ? "redo" : "undo"
  }
  return key === "y" && !event.shiftKey ? "redo" : null
}

/**
 * The frame's own address for another page with the draft: the session's
 * path with `?sayfa=` (the server reads it through `previewPage` again),
 * none for the home page.
 */
export function previewHref(pathname: string, page: string | null): string {
  return page ? `${pathname}?sayfa=${encodeURIComponent(page)}` : pathname
}

/** The editor's accent, as the panel's focus ring. */
const ACCENT = "47 111 235"

/**
 * The selection's style: a thin inset outline on the selected section,
 * its width kept on screen whatever the frame's scale; a flash (numbered,
 * so the same section flashes again) that fades in 1.2 s, or with reduced
 * motion holds still for its time. Ids pass `sectionSelector` first.
 */
export function selectionCss(
  selected: string | null,
  scale: number,
  flash: { id: string; n: number; reduced: boolean } | null
): string {
  const width = Math.max(1, Math.round((2 / Math.min(Math.max(scale, 0.05), 4)) * 100) / 100)
  const rules: string[] = []
  const chosen = selected ? sectionSelector(selected) : null
  if (chosen) {
    rules.push(
      `${chosen}{outline:${String(width)}px solid rgb(${ACCENT});outline-offset:-${String(width)}px;scroll-margin-top:var(--gf-stick-top,0px)}`
    )
  }
  const flashed = flash ? sectionSelector(flash.id) : null
  if (flash && flashed) {
    const wide = String(width * 2)
    if (flash.reduced) {
      rules.push(`${flashed}{outline:${wide}px solid rgb(${ACCENT});outline-offset:-${wide}px}`)
    } else {
      const name = `qt-editor-flash-${String(flash.n)}`
      rules.push(
        `@keyframes ${name}{from{outline:${wide}px solid rgb(${ACCENT} / 1);outline-offset:-${wide}px}to{outline:${String(width)}px solid rgb(${ACCENT} / ${chosen ? "1" : "0"});outline-offset:-${String(width)}px}}`,
        `${flashed}{animation:${name} 1.2s ease-out both}`
      )
    }
  }
  return rules.join("\n")
}
