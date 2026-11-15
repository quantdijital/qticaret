import { BRIDGE_SECTION_ID } from "@qticaret/types/editor-bridge"

/**
 * The editor layer's arithmetic (adr/0065 §4, Faz 2), as plain functions:
 * which section the pointer is over, the sections in page order, where the
 * edit label sits and how large its strokes are at the frame's scale.
 */

const MARK = "data-qs"

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
 * section is scrolled to: an opened tab gives it a box first.
 */
export function announceSelection(
  previous: { id: string; element: Element } | null,
  next: { id: string; element: Element } | null
) {
  if (previous && previous.element !== next?.element) {
    previous.element.dispatchEvent(
      new CustomEvent("qt:section:deselect", {
        bubbles: true,
        detail: { sectionId: previous.id, load: false },
      })
    )
  }
  if (next) {
    next.element.dispatchEvent(
      new CustomEvent("qt:section:select", {
        bubbles: true,
        detail: { sectionId: next.id, load: false },
      })
    )
  }
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

/**
 * Where the edit label sits, in the layer's (the viewport's) pixels: the
 * section's top right corner, kept on screen while any of the section is
 * (a tall section scrolled half away keeps its label at the top).
 */
export function labelPlace(
  rect: Box,
  viewport: { width: number; height: number },
  factor: number,
  labelHeight = 28
): { top: number; right: number } {
  const gap = 6 * factor
  const height = labelHeight * factor
  const top = Math.min(Math.max(rect.top, 0), Math.max(rect.bottom - height - gap, rect.top))
  const right = Math.max(viewport.width - Math.min(rect.right, viewport.width), 0)
  return { top: Math.round(top + gap), right: Math.round(right + gap) }
}
