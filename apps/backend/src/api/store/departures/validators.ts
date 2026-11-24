import { z } from "@medusajs/framework/zod"
import { categoryOf } from "../../../lib/seo/facets-dated"
import { DEPARTURES_LIMITS } from "../../../lib/storefront/sections/departures"

const RECORD_ID = /^[a-z]+_[0-9A-Za-z]{1,40}$/
const recordId = z.string().max(64).regex(RECORD_ID, { message: "departures.source_invalid" })

/**
 * `?limit=3..12[&category_id=|kategori=|collection_id=]` (adr/0077 §10):
 * how many departures (the section's count, 6 when not asked) and at most
 * one source: a category by id (the section's) or by handle (as a search
 * writes it), or a collection. Anything else is refused; no price is read.
 */
export const StoreGetDepartures = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(DEPARTURES_LIMITS.limit.min)
      .max(DEPARTURES_LIMITS.limit.max)
      .optional(),
    category_id: recordId.optional(),
    kategori: z
      .string()
      .max(200)
      .refine((value) => categoryOf(value) !== null, { message: "departures.source_invalid" })
      .optional(),
    collection_id: recordId.optional(),
  })
  .strict()
  .refine(
    (value) =>
      [value.category_id, value.kategori, value.collection_id].filter((each) => each !== undefined)
        .length <= 1,
    { message: "departures.source_invalid", path: ["category_id"] }
  )
export type StoreGetDeparturesType = z.infer<typeof StoreGetDepartures>
