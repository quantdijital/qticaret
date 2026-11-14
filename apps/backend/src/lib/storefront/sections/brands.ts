import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, recordId, title } from "../layout-fields"
import { bodyFields } from "./look"

/** The shop's brands. */
export const brands = z
  .object({
    ...bodyFields,
    type: z.literal("brands"),
    title,
    /** None: every brand, up to the limit. */
    brand_ids: z.array(recordId).max(LAYOUT_LIMITS.items).default([]),
  })
  .strict()
