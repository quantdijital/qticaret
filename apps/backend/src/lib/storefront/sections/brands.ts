import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, base, recordId, title } from "../layout-fields"

/** The shop's brands. */
export const brands = z
  .object({
    ...base,
    type: z.literal("brands"),
    title,
    /** None: every brand, up to the limit. */
    brand_ids: z.array(recordId).max(LAYOUT_LIMITS.items).default([]),
  })
  .strict()
