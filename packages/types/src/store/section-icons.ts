/**
 * The sections' icon set (adr/0077 §10 Ek, "ikonlu bölümler"): one closed,
 * sector-free list a shop picks a small line icon from where a section
 * draws one beside its words (a figure in the figures strip, a category in
 * the icon row). Its first eight are the trust badges' own (`TrustIcon`,
 * docs/19 §4) in their order, so a badge's icon is one of these; the rest
 * are general pictures (a place, nature, people, a time). Names are
 * English and say what is drawn; a theme maps each to its own drawing (the
 * Atolye theme to the line icons it already draws the badges with), the
 * panel's Turkish names are `storefront.editor.icons.<icon>`. The
 * contract's list: a new icon goes here first, then into the backend's
 * mirror (`lib/storefront/sections/icons.ts`, a test keeps them equal),
 * then into the themes and the panel. An icon is never taken off the list
 * (a stored design keeps reading); a reader takes one it does not know as
 * none (`sectionIconOf`).
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-icons` subpath).
 */
export const SECTION_ICONS = [
  // The trust badges' eight (`TrustIcon`), in their order
  "truck",
  "clock",
  "shield",
  "card",
  "refresh",
  "award",
  "gift",
  "phone",
  // General pictures
  "compass",
  "map_pin",
  "plane",
  "mountain",
  "palm",
  "leaf",
  "sun",
  "landmark",
  "house",
  "heart",
  "users",
  "star",
  "sparkles",
  "camera",
  "calendar",
  "tag",
  "package",
  "headset",
  "utensils",
  "gem",
] as const

export type SectionIcon = (typeof SECTION_ICONS)[number]

/** An icon as a reader takes it: one on this build's list as it is, anything else none. */
export function sectionIconOf(value: unknown): SectionIcon | null {
  return (SECTION_ICONS as readonly unknown[]).includes(value) ? (value as SectionIcon) : null
}
