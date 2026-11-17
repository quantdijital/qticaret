import { z } from "@medusajs/framework/zod"
import { optional, shopText, title } from "../layout-fields"
import { bodyFields } from "./look"

/**
 * A box of a title and a line on a page's body: the help box. The
 * newsletter's box has its variants (`newsletter.ts`).
 */
export const worded = (type: "help") =>
  z.object({ ...bodyFields, type: z.literal(type), title, text: optional(shopText(240)) }).strict()
