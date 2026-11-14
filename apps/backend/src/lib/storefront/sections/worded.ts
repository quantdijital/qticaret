import { z } from "@medusajs/framework/zod"
import { base, optional, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"

/** A box of a title and a line: the newsletter's sign-up, the help box, on a page's body. */
export const worded = (type: "newsletter" | "help") =>
  z.object({ ...bodyFields, type: z.literal(type), title, text: optional(shopText(240)) }).strict()

/** The footer's newsletter box: no look of its own (the footer's frame is adr/0049 §9 V3's). */
export const footerNewsletter = z
  .object({ ...base, type: z.literal("newsletter"), title, text: optional(shopText(240)) })
  .strict()
