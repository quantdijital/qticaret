import { z } from "@medusajs/framework/zod"
import { base, title } from "../layout-fields"

/**
 * The home page's Google rating badge (`google_rating`, adr/0049 Ek and
 * adr/0058 Ek 2026-11-06): Google's own average and count from the shop's
 * Business Profile, a link to `/yorumlar` and, if the shop wants, to its
 * place on Google Maps, and up to three recent four- and five-star review
 * excerpts the shop did not hide. The storefront fetches the figures at
 * each request (as the other reviews); with no connection or nothing to
 * show it draws nothing. Never structured data.
 */

export const GOOGLE_RATING_LIMITS = {
  /** Review excerpts under the badge: none (off) to three. */
  excerpts: { min: 0, max: 3, default: 0 },
  /** The fewest stars an excerpt has. */
  min_rating: 4,
} as const

export const googleRating = z
  .object({
    ...base,
    type: z.literal("google_rating"),
    /** None: the storefront's own ("Google'da bizi değerlendirenler"). */
    title,
    excerpts: z
      .number()
      .int()
      .min(GOOGLE_RATING_LIMITS.excerpts.min)
      .max(GOOGLE_RATING_LIMITS.excerpts.max)
      .default(GOOGLE_RATING_LIMITS.excerpts.default),
    /** "Google'da gör": the place on Google Maps, beside the link to `/yorumlar`. */
    profile_link: z.boolean().default(true),
  })
  .strict()

export type GoogleRatingSection = z.infer<typeof googleRating>
