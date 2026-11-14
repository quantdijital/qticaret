import { z } from "@medusajs/framework/zod"
import { image, optional, shopText } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"

/** The page's opening: a line above, a heading, a text, up to two buttons and a picture. */
export const hero = z
  .object({
    ...bodyFields,
    type: z.literal("hero"),
    eyebrow: optional(shopText(40)),
    /** None: the shop's name. */
    heading: optional(shopText(90)),
    text: optional(shopText(240)),
    links: z.array(storefrontLink).max(2).default([]),
    image: optional(image),
  })
  .strict()
