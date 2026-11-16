import type { DefinitionForm } from "./form"

/** Pure helpers for the template editor's attribute list: order, the open row, what is set. */

export type DropPlace = "before" | "after"

/** Where a row dragged from `from` lands when dropped before or after the row at `at`. */
export function dropIndex(from: number, at: number, place: DropPlace): number {
  const target = place === "before" ? at : at + 1
  return from < target ? target - 1 : target
}

/** The open row's index once the row at `from` moved to `to`. */
export function followMove(open: number | null, from: number, to: number): number | null {
  if (open === null) {
    return null
  }
  if (open === from) {
    return to
  }
  if (from < open && to >= open) {
    return open - 1
  }
  if (from > open && to <= open) {
    return open + 1
  }
  return open
}

/** The open row's index once the row at `removed` went. */
export function followRemove(open: number | null, removed: number): number | null {
  if (open === null || open === removed) {
    return null
  }
  return open > removed ? open - 1 : open
}

/**
 * The advanced settings an attribute holds apart from their defaults:
 * shown on the folded "Gelişmiş" header, so nothing set hides there.
 */
export function advancedChanges(definition: DefinitionForm): number {
  const variant = definition.scope === "variant"
  const shown = variant || definition.is_public
  return [
    variant,
    variant && definition.varies_by !== "",
    shown && definition.is_seo_highlight,
    !variant && definition.aliases.length > 0,
    definition.type === "text" && definition.unit.trim() !== "",
  ].filter(Boolean).length
}
