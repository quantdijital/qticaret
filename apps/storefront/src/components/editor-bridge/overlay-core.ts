import { BRIDGE_SECTION_ID } from "@qticaret/types/editor-bridge"
import { sectionSelector } from "./bridge-core"

/**
 * The editor layer's arithmetic (adr/0065 §4, Faz 2), as plain functions:
 * which section the pointer is over, the sections in page order, where the
 * edit label sits and how large its strokes are at the frame's scale.
 */

const MARK = "data-qs"
/** The section chosen in the editor, for a theme part that starts listening late. */
export const SELECTED_MARK = "data-qt-selected"

/** The nearest section around `node` (its own or an ancestor's mark); null outside any. */
export function sectionAround(node: unknown): { id: string; element: Element } | null {
  let element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null
  while (element) {
    const id = element.getAttribute(MARK)
    if (id !== null && BRIDGE_SECTION_ID.test(id)) {
      return { id, element }
    }
    element = element.parentElement
  }
  return null
}

interface Box {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

/** Whether a section has a box on the page (a hidden tab's or `display:none` one has none). */
export const isDrawn = (rect: Pick<Box, "width" | "height">): boolean =>
  rect.width > 0 && rect.height > 0

/** The sections drawn on the page, in page order (`limit` at most). */
export function drawnSections(root: ParentNode, limit = 400): { id: string; element: Element }[] {
  const found: { id: string; element: Element }[] = []
  for (const element of root.querySelectorAll(`[${MARK}]`)) {
    const id = element.getAttribute(MARK) ?? ""
    if (BRIDGE_SECTION_ID.test(id) && isDrawn(element.getBoundingClientRect())) {
      found.push({ id, element })
      if (found.length >= limit) {
        break
      }
    }
  }
  return found
}

/** The section a step (Alt+↓ is +1, Alt+↑ is −1) lands on from `current`: none yet, the first or last. */
export function stepSection(ids: readonly string[], current: string | null, step: 1 | -1) {
  if (ids.length === 0) {
    return null
  }
  const at = current === null ? -1 : ids.indexOf(current)
  if (at === -1) {
    return step === 1 ? (ids[0] ?? null) : (ids[ids.length - 1] ?? null)
  }
  return ids[Math.min(Math.max(at + step, 0), ids.length - 1)] ?? null
}

/**
 * The theme's editor events (adr/0065 §2, Shopify's `shopify:section:*`):
 * `qt:section:deselect` on the section left, `qt:section:select` on the
 * one chosen, both bubbling with `{ sectionId, load: false }`, so a theme
 * may open a hidden tab or hold a slider still. Dispatched before the
 * section is scrolled to: an opened tab gives it a box first. The chosen
 * section also carries `data-qt-selected`: a section just added is found
 * before its theme part listens, so the part reads the mark when it does.
 */
export function announceSelection(
  previous: { id: string; element: Element } | null,
  next: { id: string; element: Element } | null
) {
  if (previous && previous.element !== next?.element) {
    previous.element.removeAttribute(SELECTED_MARK)
    previous.element.dispatchEvent(
      new CustomEvent("qt:section:deselect", {
        bubbles: true,
        detail: { sectionId: previous.id, load: false },
      })
    )
  }
  if (next) {
    next.element.setAttribute(SELECTED_MARK, "")
    next.element.dispatchEvent(
      new CustomEvent("qt:section:select", {
        bubbles: true,
        detail: { sectionId: next.id, load: false },
      })
    )
  }
}

/**
 * The panel's choice as drawn now, after a redraw: a section chosen before
 * it could be drawn (just added, not valid yet, so the wait ran out) or
 * drawn anew is announced once it is in the page. Returns the chosen one.
 */
export function settleSelection(
  chosen: { id: string; element: Element } | null,
  selected: string | null,
  root: ParentNode = document
): { id: string; element: Element } | null {
  if (!selected || (chosen?.id === selected && chosen.element.isConnected)) {
    return chosen
  }
  const selector = sectionSelector(selected)
  const element = selector ? root.querySelector(selector) : null
  if (!element) {
    return chosen
  }
  const next = { id: selected, element }
  announceSelection(chosen?.element.isConnected ? chosen : null, next)
  return next
}

/** The step a key asks for in the frame: Alt+↓ the next section, Alt+↑ the one before. */
export function sectionStep(event: {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): 1 | -1 | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return null
  }
  return event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : null
}

/**
 * The factor the layer's strokes and label are drawn at: the panel scales
 * the whole frame down (`preview-fit.ts`), so a 2 px line inside is 2/scale.
 */
export const strokeFactor = (scale: number): number =>
  Math.round((1 / Math.min(Math.max(scale, 0.05), 4)) * 1000) / 1000

/** A label's corner: from the right edge of the view, or (under a header) from the left. */
export type LabelPlace = { top: number; right: number } | { top: number; left: number }

/**
 * Where the edit label sits, in the layer's (the viewport's) pixels: the
 * section's top right corner, kept on screen while any of the section is
 * (a tall section scrolled half away keeps its label at the top). A short
 * section at the top of the view (the page's header) has its cart and
 * search in that corner: its label hangs under its bottom edge on the left,
 * touching it, clear of the next section's own label on the right.
 */
export function labelPlace(
  rect: Box,
  viewport: { width: number; height: number },
  factor: number,
  labelHeight = 28
): LabelPlace {
  const gap = 6 * factor
  const height = labelHeight * factor
  const atTop = rect.top >= 0 && rect.top <= gap
  if (atTop && rect.height <= viewport.height / 3 && rect.bottom + height <= viewport.height) {
    return { top: Math.round(rect.bottom), left: Math.round(Math.max(rect.left, 0) + gap) }
  }
  const top = Math.min(Math.max(rect.top, 0), Math.max(rect.bottom - height - gap, rect.top))
  const right = Math.max(viewport.width - Math.min(rect.right, viewport.width), 0)
  return { top: Math.round(top + gap), right: Math.round(right + gap) }
}
