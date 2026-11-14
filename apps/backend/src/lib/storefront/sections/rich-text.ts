import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../../content"
import { title } from "../layout-fields"
import { bodyFields } from "./look"

/** The shop's own text, written in the content editor (adr/0019). */
export const richText = z
  .object({ ...bodyFields, type: z.literal("rich_text"), title, body: contentDoc })
  .strict()
