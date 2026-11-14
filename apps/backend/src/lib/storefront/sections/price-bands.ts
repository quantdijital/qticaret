import { z } from "@medusajs/framework/zod"
import { optional, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"

/**
 * The price bands strip, `price_bands` (adr/0049 Ek 2026-11-14, note
 * "Katalog ana sayfası"): two to four bands, each a label, an optional
 * line and an upper bound in whole units of the shop's currency (none:
 * "and up", the last band only); every bound above the one before. A
 * band's range runs from the band before's bound to its own. Its products
 * are picked on the server by their indexed prices (never a price from the
 * editor, golden rule 5); the storefront links each band to the catalogue
 * filtered by its range. On the home page.
 *
 * Mirrors `@qticaret/types`' `PRICE_BANDS_LIMITS` and `bandsRise` (the
 * backend reads no runtime value from that package); a unit test keeps
 * them equal.
 */
export const PRICE_BANDS_LIMITS = {
  bands: { min: 2, max: 4 },
  label: 30,
  text: 80,
  max: 10_000_000,
  thumbs: { min: 0, max: 4, default: 3 },
} as const

const L = PRICE_BANDS_LIMITS

/** Every bound above the one before; only the last band without one. */
export function bandsRise(bands: readonly { max: number | null }[]): boolean {
  return bands.every((band, index) => {
    if (band.max === null) {
      return index === bands.length - 1
    }
    const before = bands[index - 1]?.max
    return before === undefined || (before !== null && band.max > before)
  })
}

/** Each band's range: the band before's bound (none first) to its own (none: open). */
export const bandRanges = (bands: readonly { max: number | null }[]) =>
  bands.map((band, index) => ({ min: bands[index - 1]?.max ?? null, max: band.max }))

const band = z
  .object({
    label: shopText(L.label),
    text: optional(shopText(L.text)),
    max: z.number().int().min(1).max(L.max).nullable(),
  })
  .strict()

export const priceBands = z
  .object({
    ...bodyFields,
    type: z.literal("price_bands"),
    title,
    bands: z
      .array(band)
      .min(L.bands.min)
      .max(L.bands.max)
      .refine((bands) => bandsRise(bands), { message: "storefront_layout.price_bands_order" }),
    /** Products shown small in each band, 0 for none. */
    thumbs: z.number().int().min(L.thumbs.min).max(L.thumbs.max).default(L.thumbs.default),
  })
  .strict()

export type PriceBandsSection = z.infer<typeof priceBands>
