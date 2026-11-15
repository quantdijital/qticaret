import { z } from "@medusajs/framework/zod"
import { optional, recordId, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"

/**
 * The price bands strip, `price_bands` (adr/0049 Ek 2026-11-14, note
 * "Katalog ana sayfası"): two to four bands, each a label, an optional
 * line, an optional category and an upper bound in whole units of the
 * shop's currency. A band without a category is a price band: the price
 * bands split the shop's prices, every bound above the price band
 * before's, only the last without one ("and up"); a price band's range runs
 * from just above the price band before's bound to its own. A band with a
 * category (adr/0049, dated line 2026-11-15) stands apart: the category's
 * products up to its own bound, none: the whole category. Its products are
 * picked on the server by their indexed prices (never a price from the
 * editor, golden rule 5); the storefront links each band to its category's
 * listing, else the catalogue's, filtered by its range. On the home page.
 * A design from before band categories reads as it did (no category).
 *
 * Mirrors `@qticaret/types`' `PRICE_BANDS_LIMITS`, `bandsRise` and
 * `bandRanges` (the backend reads no runtime value from that package); a
 * unit test keeps them equal.
 */
export const PRICE_BANDS_LIMITS = {
  bands: { min: 2, max: 4 },
  label: 30,
  text: 80,
  max: 10_000_000,
  thumbs: { min: 0, max: 4, default: 3 },
  /** Strips a page (the home page) shows at most. */
  perPage: 2,
} as const

const L = PRICE_BANDS_LIMITS

interface BandBounds {
  max: number | null
  category_id?: string | null
}

/** Whether the band is a price band: no category of its own. */
const priced = (band: BandBounds) => !band.category_id

/** Every price band's bound above the price band before's; only the last price band without one. */
export function bandsRise(bands: readonly BandBounds[]): boolean {
  const prices = bands.filter(priced)
  return prices.every((band, index) => {
    if (band.max === null) {
      return index === prices.length - 1
    }
    const before = prices[index - 1]?.max
    return before === undefined || (before !== null && band.max > before)
  })
}

/**
 * Each band's range: a price band's one whole unit above the price band
 * before's bound (none first) to its own (none: open), so a price on a
 * bound is in the lower band only; a category band's up to its own bound
 * (none: no price). The listing's price filter takes both ends.
 */
export function bandRanges(
  bands: readonly BandBounds[]
): { min: number | null; max: number | null }[] {
  let before: number | null | undefined
  return bands.map((band) => {
    if (!priced(band)) {
      return { min: null, max: band.max }
    }
    const min = before === undefined || before === null ? null : before + 1
    before = band.max
    return { min, max: band.max }
  })
}

const band = z
  .object({
    label: shopText(L.label),
    text: optional(shopText(L.text)),
    max: z.number().int().min(1).max(L.max).nullable(),
    /** The band's category; none (and a band from before it): a price band over the whole shop. */
    category_id: optional(recordId),
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
