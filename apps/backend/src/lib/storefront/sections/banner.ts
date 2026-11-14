import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, base, image, optional, shopText } from "../layout-fields"
import { storefrontLink } from "../menus"

/** One to six pictures, each with its heading, a line and one link. */
export const banner = z
  .object({
    ...base,
    type: z.literal("banner"),
    slides: z
      .array(
        z
          .object({
            image,
            heading: optional(shopText(90)),
            text: optional(shopText(160)),
            link: optional(storefrontLink),
          })
          .strict()
      )
      .min(1)
      .max(LAYOUT_LIMITS.slides),
  })
  .strict()
