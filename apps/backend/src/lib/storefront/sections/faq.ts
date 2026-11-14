import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, base, shopText, text, title } from "../layout-fields"

/** Questions and answers, shown on the page; never `FAQPage` structured data (docs/13 §5). */
export const faq = z
  .object({
    ...base,
    type: z.literal("faq"),
    title,
    items: z
      .array(z.object({ question: text(160), answer: shopText(600) }).strict())
      .min(1)
      .max(LAYOUT_LIMITS.faq),
  })
  .strict()
