import { z } from "@medusajs/framework/zod"
import { base, optional, shopText, title } from "../layout-fields"

/** A box of a title and a line: the newsletter's sign-up, the help box. */
export const worded = (type: "newsletter" | "help") =>
  z.object({ ...base, type: z.literal(type), title, text: optional(shopText(240)) }).strict()
