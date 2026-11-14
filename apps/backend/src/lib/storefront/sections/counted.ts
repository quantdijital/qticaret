import { z } from "@medusajs/framework/zod"
import { title } from "../layout-fields"
import { bodyFields } from "./look"

/** The newest posts or reviews, up to a count. */
export const counted = (type: "posts" | "reviews", max: number, fallback: number) =>
  z
    .object({
      ...bodyFields,
      type: z.literal(type),
      title,
      limit: z.number().int().min(1).max(max).default(fallback),
    })
    .strict()
