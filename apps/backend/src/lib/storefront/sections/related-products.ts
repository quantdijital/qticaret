import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, columns, columnsMobile, optional, title } from "../layout-fields"
import { bodyFields } from "./look"
import { scroller } from "./scroller"
import { collectionSource, manualSource } from "./sources"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"
import { PRODUCT_CARD_VARIANTS } from "../../../modules/platform-settings/sections/theme"

/** What both variants hold, under the same names (switching keeps them). */
const common = {
  ...bodyFields,
  type: z.literal("related_products"),
  title,
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("same_category") }).strict(),
    collectionSource,
    manualSource(LAYOUT_LIMITS.related),
  ]),
  limit: z.number().int().min(1).max(LAYOUT_LIMITS.related).default(8),
  /**
   * The rail's own card variant over the theme setting's (bilesen-denetimi
   * (b) 7, as a product rail's); null: the setting's.
   */
  card_variant: optional(z.enum(PRODUCT_CARD_VARIANTS, VARIANT_ERROR)),
}

/** Today's rows: the shop's cards in a row on a wide screen and on a phone. */
const grid = z
  .object({
    ...common,
    variant: defaultVariant("related_products"),
    columns,
    columns_mobile: columnsMobile,
  })
  .strict()

/** One row that slides sideways, driven by the scroller kit. */
const carousel = z.object({ ...common, variant: z.literal("carousel"), scroller }).strict()

export const RELATED_BRANCHES: Readonly<Record<SectionVariant<"related_products">, VariantBranch>> =
  { grid, carousel }

/** Products shown under a product's own: its category's, a collection's, or chosen ones. */
export const relatedProducts = z.discriminatedUnion("variant", [grid, carousel], VARIANT_ERROR)
