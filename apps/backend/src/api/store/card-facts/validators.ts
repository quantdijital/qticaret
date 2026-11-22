import { z } from "@medusajs/framework/zod"
import { MAX_PAX, monthsOf, rangeOf, todayIn } from "../../../lib/seo/facets-dated"

// A listing's page, a search's or a home rail's: enough for one request
const MAX_PRODUCTS = 100

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * `?id=…&id=…` (or one): the products of one storefront page. A date
 * search's page (adr/0077 §4) adds its dates, `from` and `to` (both
 * days included) or `months` (`YYYY-MM[,YYYY-MM]`), and `pax`, read by
 * the search's own rules (facets-dated.ts): a dated card then says the
 * nearest departure inside them, its places left and the from price over
 * them. Without them the answer is as before.
 */
export const StoreGetCardFacts = z
  .object({
    id: z
      .union([z.string(), z.array(z.string())])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(
        z
          .array(z.string().regex(/^prod_[0-9A-Za-z]{1,64}$/))
          .min(1)
          .max(MAX_PRODUCTS)
      ),
    // The region a dated card's from price is read in (adr/0076 §10); none: lira
    region_id: z
      .string()
      .regex(/^reg_[0-9A-Za-z]{1,40}$/)
      .optional(),
    from: z.string().regex(DAY).optional(),
    to: z.string().regex(DAY).optional(),
    months: z.string().max(30).optional(),
    pax: z.coerce.number().int().min(1).max(MAX_PAX).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const today = todayIn(new Date())
    if ((value.from === undefined) !== (value.to === undefined)) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "card_facts.range_invalid" })
      return
    }
    if (value.from !== undefined && value.months !== undefined) {
      ctx.addIssue({ code: "custom", path: ["months"], message: "card_facts.dates_twice" })
      return
    }
    if (value.from !== undefined && !rangeOf(`${value.from}_${value.to ?? ""}`, today)) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "card_facts.range_invalid" })
    }
    const months = value.months === undefined ? null : monthsOf(value.months, today)
    // Every month asked must be one the search reads, none dropped
    if (
      value.months !== undefined &&
      (months?.kind !== "months" || months.months.join(",") !== value.months)
    ) {
      ctx.addIssue({ code: "custom", path: ["months"], message: "card_facts.months_invalid" })
    }
  })
export type StoreGetCardFactsType = z.infer<typeof StoreGetCardFacts>
