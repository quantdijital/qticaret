import { z } from "@medusajs/framework/zod"
import { optional, shopText, title } from "../layout-fields"
import { storefrontLink } from "../menus"
import { bodyFields } from "./look"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The shop's newest posts, up to a count, drawn two ways (adr/0077 Ek,
 * "Vadi"): `grid`, today's tiles, the default a posts section saved
 * before variants reads as; `intro_panel` ("Tanıtım paneli"), one rounded
 * panel on the section's ground with an upper line, the heading, a short
 * intro and one button beside two or three post cards. The title and the
 * count are every variant's and stay across a switch.
 *
 * Mirrors `@qticaret/types`' `POSTS_INTRO_LIMITS`; a unit test keeps them equal.
 */
export const POSTS_INTRO_LIMITS = { eyebrow: 40, intro: 200 } as const

const common = {
  ...bodyFields,
  type: z.literal("posts"),
  title,
  limit: z.number().int().min(1).max(6).default(3),
}

const grid = z.object({ ...common, variant: defaultVariant("posts") }).strict()

const introPanel = z
  .object({
    ...common,
    variant: z.literal("intro_panel"),
    eyebrow: optional(shopText(POSTS_INTRO_LIMITS.eyebrow)),
    intro: optional(shopText(POSTS_INTRO_LIMITS.intro)),
    /** The panel's button; none: the storefront's "every post". */
    link: optional(storefrontLink),
  })
  .strict()

/** What a posts section read as each variant keeps (`storedSection`). */
export const POSTS_BRANCHES: Readonly<Record<SectionVariant<"posts">, VariantBranch>> = {
  grid,
  intro_panel: introPanel,
}

/** On the home and content pages. */
export const posts = z.discriminatedUnion("variant", [grid, introPanel], VARIANT_ERROR)

export type PostsSection = z.infer<typeof posts>
