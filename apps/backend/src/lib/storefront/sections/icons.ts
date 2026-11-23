import { z } from "@medusajs/framework/zod"

/**
 * The sections' icon set (adr/0077 §10 Ek): mirrors `@qticaret/types`'
 * `SECTION_ICONS` (the backend reads no runtime value from that package);
 * a unit test keeps them equal. Its first eight are the trust badges' own
 * (`TRUST_ICONS`). An icon is never taken off the list.
 */
export const SECTION_ICONS = [
  "truck",
  "clock",
  "shield",
  "card",
  "refresh",
  "award",
  "gift",
  "phone",
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

/** An icon off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
export const sectionIcon = z.custom<SectionIcon>(
  (value) => (SECTION_ICONS as readonly unknown[]).includes(value),
  { error: "storefront_layout.section_invalid" }
)
