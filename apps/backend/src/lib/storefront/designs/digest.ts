import { createHash } from "node:crypto"
import type { LayoutDocument } from "../layout"

/**
 * The settings a look does not carry when it is compared (adr/0064 Ek
 * 2026-11-17 §2): its own labels (`design`, `preset`), a menu set waiting
 * to go live (the shop's menus are its own) and the shop's data an apply
 * keeps from the draft (trust badges, colour swatches, "Az kaldı").
 */
const NOT_COMPARED = [
  "design",
  "preset",
  "menus",
  "trust_badges",
  "color_swatches",
  "low_stock",
] as const

/** JSON with every object's keys in order: the same value, the same text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(",")}}`
  }
  // JSON has no `undefined` (an array's hole reads as null)
  return value === undefined ? "null" : JSON.stringify(value)
}

/** sha256 of any stored value, its keys in order (a document today's schema no longer reads). */
export const rawDigest = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex")

/**
 * A look's fingerprint: the design as the editor opens it (`filled`: read
 * through today's schema, unset parts filled as `withLegacySettings`
 * fills them, so the editor's first save is no change) without the
 * settings it does not carry (`NOT_COMPARED`). Two designs alike in
 * every section and in the theme have the same digest.
 */
export function designDigest(filled: LayoutDocument): string {
  const skipped: readonly string[] = NOT_COMPARED
  const settings = Object.fromEntries(
    Object.entries(filled.settings).filter(([key]) => !skipped.includes(key))
  )
  return rawDigest({ ...filled, settings })
}
