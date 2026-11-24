import { z } from "@medusajs/framework/zod"
import { optional, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"

/**
 * The search box section (`search_box`, adr/0077 §1): an optional title
 * and intro over the shop's one search box. The box's fields are the
 * theme's (`search_form`), not the section's; its ground and alignment are
 * the look's. Mirrors `@qticaret/types`' `SEARCH_BOX_LIMITS` (the backend
 * reads no runtime value from that package); a unit test keeps them equal.
 */
export const SEARCH_BOX_LIMITS = {
  intro: 240,
} as const

export const searchBox = z
  .object({
    ...bodyFields,
    type: z.literal("search_box"),
    /** None: no heading. */
    title,
    intro: optional(shopText(SEARCH_BOX_LIMITS.intro)),
  })
  .strict()

export type SearchBoxSection = z.infer<typeof searchBox>
