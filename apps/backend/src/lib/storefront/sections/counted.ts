import { z } from "@medusajs/framework/zod"
import { title } from "../layout-fields"
import { bodyFields } from "./look"

/** The newest reviews, up to a count (the posts have their own variants, `posts.ts`). */
export const counted = (type: "reviews", max: number, fallback: number) =>
  z
    .object({
      ...bodyFields,
      type: z.literal(type),
      title,
      limit: z.number().int().min(1).max(max).default(fallback),
    })
    .strict()
