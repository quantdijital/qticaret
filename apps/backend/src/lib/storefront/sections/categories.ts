import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, recordId, title } from "../layout-fields"
import { bodyFields } from "./look"

/** The shop's categories as cards. */
export const categories = z
  .object({
    ...bodyFields,
    type: z.literal("categories"),
    title,
    /** None: the top categories. */
    category_ids: z.array(recordId).max(LAYOUT_LIMITS.items).default([]),
  })
  .strict()
