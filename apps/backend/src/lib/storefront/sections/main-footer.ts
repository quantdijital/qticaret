import { z } from "@medusajs/framework/zod"
import { base } from "../layout-fields"
import { footerBarFields, footerColumnsFields } from "./footer-bar"
import { footerRowsFields } from "./footer-rows"
import { VARIANT_ERROR, defaultVariant } from "./variants"

/**
 * The footer bar's variants (adr/0049 Ek 2026-11-14 §5), each its own
 * `strict` branch: the footer's own settings (`footerBarFields`) in every
 * one, a variant's only in its own, so a document never keeps two
 * variants' fields together.
 */

export const MAIN_ERROR = { error: "storefront_layout.section_invalid" }

/** Always shown: a main section cannot be hidden or scheduled away (a forged editor is refused). */
export const mainBase = {
  id: base.id,
  visible: z.custom<true>((value) => value === true, MAIN_ERROR).default(true),
  starts_at: z.custom<null>((value) => value === null, MAIN_ERROR).default(null),
  ends_at: z.custom<null>((value) => value === null, MAIN_ERROR).default(null),
}

/**
 * Today's footer: Grafit's ledger of the shop's details, menus and marks,
 * with the footer's own settings (adr/0049 Ek 2026-11-15, `footer-bar.ts`).
 */
export const footerLedger = z
  .object({
    ...mainBase,
    type: z.literal("footer_bar"),
    variant: defaultVariant("footer_bar"),
    ...footerBarFields,
  })
  .strict()

/**
 * The brand columns footer (adr/0049 Ek 2026-11-17): the footer's own
 * settings and the variant's (`footerColumnsFields`), each with a default,
 * so a footer switched to it reads whole.
 */
export const footerColumns = z
  .object({
    ...mainBase,
    type: z.literal("footer_bar"),
    variant: z.literal("brand_columns"),
    ...footerBarFields,
    ...footerColumnsFields,
  })
  .strict()

/**
 * The free rows footer (adr/0070, "Serbest düzen"): the footer's own
 * settings, the variant's ground and marks, and the shop's rows of blocks
 * (`footer-rows.ts`); one switched to it with no rows reads the starting row.
 */
export const footerFreeRows = z
  .object({
    ...mainBase,
    type: z.literal("footer_bar"),
    variant: z.literal("free_rows"),
    ...footerBarFields,
    ...footerRowsFields,
  })
  .strict()

export const footerBar = z.discriminatedUnion(
  "variant",
  [footerLedger, footerColumns, footerFreeRows],
  VARIANT_ERROR
)

export type FooterBar = z.infer<typeof footerBar>
export type FooterFreeRows = z.infer<typeof footerFreeRows>
