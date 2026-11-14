import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, optional, recordId, title } from "../layout-fields"
import { storefrontLink } from "../menus"
import { bodyFields } from "./look"

/** The shop's categories as cards. */
export const categories = z
  .object({
    ...bodyFields,
    type: z.literal("categories"),
    title,
    /** None: the top categories. */
    category_ids: z.array(recordId).max(LAYOUT_LIMITS.items).default([]),
    /** Each card's product count (adr/0049 Ek 2026-11-14 §10 karar 7b); off as before. */
    show_count: z.boolean().default(false),
    /** The link beside the title; none: the storefront's "every category". */
    more: optional(storefrontLink),
  })
  .strict()
