import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../../content"
import { base, title } from "../layout-fields"

/** The shop's own text, written in the content editor (adr/0019). */
export const richText = z
  .object({ ...base, type: z.literal("rich_text"), title, body: contentDoc })
  .strict()
