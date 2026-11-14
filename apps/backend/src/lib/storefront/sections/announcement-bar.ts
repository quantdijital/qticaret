import { z } from "@medusajs/framework/zod"
import { base, shopText } from "../layout-fields"

/** The header's announcement bar: one to five lines of the shop's words. */
export const announcementBar = z
  .object({
    ...base,
    type: z.literal("announcement_bar"),
    lines: z.array(shopText(120)).min(1).max(5),
  })
  .strict()
