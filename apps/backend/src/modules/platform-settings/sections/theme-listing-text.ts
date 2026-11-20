import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "./define"

/**
 * How a category, brand or collection page's own text looks at the foot
 * of the page (adr/0075): one theme setting for the whole shop, a group
 * of the theme section (`listing_text`), drafted and published with the
 * design. Mirrors `@qticaret/types`' `listing-text.ts` (a unit test keeps
 * them equal). The face is the theme's body face.
 */
export const LISTING_TEXT = {
  size: ["sm", "md", "lg"],
  align: ["start", "center"],
  width: ["narrow", "wide"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export interface ListingTextSettings {
  size: (typeof LISTING_TEXT.size)[number]
  align: (typeof LISTING_TEXT.align)[number]
  width: (typeof LISTING_TEXT.width)[number]
  /** A long text folds behind "Devamını oku"; it stays in the page's HTML either way. */
  collapse: boolean
}

/** Normal size, from the start, a reading measure, collapsed. */
export const LISTING_TEXT_DEFAULTS: Readonly<ListingTextSettings> = {
  size: "md",
  align: "start",
  width: "narrow",
  collapse: true,
}

/** The group's schema: a step on its list only, every field present. */
export const listingTextSchema = z
  .object({
    size: z.enum(LISTING_TEXT.size),
    align: z.enum(LISTING_TEXT.align),
    width: z.enum(LISTING_TEXT.width),
    collapse: z.boolean(),
  })
  .strict()

/**
 * Theme settings with the group at its defaults where it or a field of it
 * is missing: a design's theme, a preset or a panel save written before
 * adr/0075 reads as the defaults. A value off a list is kept, for the
 * schema to refuse.
 */
export function withListingTextDefaults(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value
  }
  const group = value["listing_text"]
  if (group !== undefined && !isPlainObject(group)) {
    return value
  }
  return { ...value, listing_text: { ...LISTING_TEXT_DEFAULTS, ...group } }
}
