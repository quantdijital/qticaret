import { z } from "@medusajs/framework/zod"
import { title } from "../layout-fields"
import { bodyFields } from "./look"

/** The newest posts, up to a count (the reviews have their own variants, `reviews.ts`). */
export const counted = (type: "posts", max: number, fallback: number) =>
  z
    .object({
      ...bodyFields,
      type: z.literal(type),
      title,
      limit: z.number().int().min(1).max(max).default(fallback),
    })
    .strict()
