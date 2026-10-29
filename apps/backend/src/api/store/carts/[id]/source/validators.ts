import { z } from "@medusajs/framework/zod"

const word = z
  .string()
  .trim()
  .max(100)
  .regex(/^[\p{L}\p{N} ._\-+/:]*$/u)

/**
 * The cart's first landing as the storefront read it (F11.2): the
 * campaign's `utm_*` words, the referring page's address (only its host
 * is kept), and whether an ad click id was there; never the ids themselves.
 */
export const StorePostCartSource = z
  .object({
    utm_source: word.optional(),
    utm_medium: word.optional(),
    utm_campaign: word.optional(),
    referrer: z
      .url({ protocol: /^https?$/ })
      .max(2000)
      .optional(),
    gclid: z.boolean().optional(),
    fbclid: z.boolean().optional(),
  })
  .strict()

export type StorePostCartSourceType = z.infer<typeof StorePostCartSource>
