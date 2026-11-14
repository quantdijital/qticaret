import { z } from "@medusajs/framework/zod"
import { base, title } from "../layout-fields"

/** The newest posts or reviews, up to a count. */
export const counted = (type: "posts" | "reviews", max: number, fallback: number) =>
  z
    .object({
      ...base,
      type: z.literal(type),
      title,
      limit: z.number().int().min(1).max(max).default(fallback),
    })
    .strict()
