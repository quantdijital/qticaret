import { z } from "@medusajs/framework/zod"
import { title } from "../layout-fields"
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
}

/** Today's drawing: the shop's summary beside the three newest quotes. */
const grid = z.object({ ...common, variant: defaultVariant("reviews") }).strict()

/** adr/0077 §10: the newest reviews one card each in a row that slides (the scroller kit). */
const carousel = z.object({ ...common, variant: z.literal("carousel"), scroller }).strict()

export const REVIEWS_BRANCHES: Readonly<Record<SectionVariant<"reviews">, VariantBranch>> = {
  grid,
  carousel,
}

/** The shop's newest approved reviews, up to a count: as a grid, or as a carousel. */
export const reviews = z.discriminatedUnion("variant", [grid, carousel], VARIANT_ERROR)

export type ReviewsSection = z.infer<typeof reviews>
