import { z } from "@medusajs/framework/zod"
import { title } from "../layout-fields"
import { headLines } from "./head-lines"
import { bodyFields } from "./look"
import { scroller } from "./scroller"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/** What both variants hold, under the same names (switching keeps them). */
const common = {
  ...bodyFields,
  type: z.literal("reviews"),
  title,
  limit: z.number().int().min(1).max(12).default(6),
  /** The line over the heading and the hand note beside it (`head-lines.ts`). */
  ...headLines,
}

/** Today's drawing: the shop's summary beside the three newest quotes. */
const grid = z.object({ ...common, variant: defaultVariant("reviews") }).strict()

/**
 * The reviewed product's picture on each carousel card (adr/0077 §10 Ek):
 * none (today's card), a small square beside its name, or a short cover
 * across the card's top. Mirrors `@qticaret/types`' `section-reviews.ts`.
 */
export const REVIEWS_PRODUCT_IMAGES = ["none", "thumb", "cover", "compact"] as const

/**
 * adr/0077 §10: the newest reviews one card each in a row that slides (the
 * scroller kit). `product_image` absent until written: a carousel saved
 * before it prints as it did.
 */
const carousel = z
  .object({
    ...common,
    variant: z.literal("carousel"),
    scroller,
    product_image: z
      .enum(REVIEWS_PRODUCT_IMAGES, { error: "storefront_layout.section_invalid" })
      .optional(),
  })
  .strict()

export const REVIEWS_BRANCHES: Readonly<Record<SectionVariant<"reviews">, VariantBranch>> = {
  grid,
  carousel,
}

/** The shop's newest approved reviews, up to a count: as a grid, or as a carousel. */
export const reviews = z.discriminatedUnion("variant", [grid, carousel], VARIANT_ERROR)

export type ReviewsSection = z.infer<typeof reviews>
