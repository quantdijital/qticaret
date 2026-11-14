import { z } from "@medusajs/framework/zod"
import { TRUST_ICONS } from "../../../modules/platform-settings/sections/storefront"
import { base, optional, placement, shopText } from "../layout-fields"
import { storefrontLink } from "../menus"
import { bodyFields } from "./look"

/**
 * The scrolling strip, `marquee` (adr/0049 Ek 2026-11-14 §4.1; E1, the
 * mockups' KY1 and KY3): one to eight short items, each an optional icon
 * from the trust badges' list, a line (the shop's details as
 * `{belirteç}`s), an optional second line and an optional link to one of
 * the shop's records, pages or an https address (`storefrontLink`); and
 * how it moves and looks, each a closed list of named steps the theme maps
 * onto its own scale. On the home, product and category pages, and at most
 * one in the header group above the shop's header (§10 karar 9); a page
 * shows two at most (`layout.ts`).
 *
 * Mirrors `@qticaret/types`' `MARQUEE_SETTINGS` and `MARQUEE_LIMITS` (the
 * backend reads no runtime value from that package); a unit test keeps
 * them equal.
 */
export const MARQUEE_SETTINGS = {
  speed: ["slow", "medium", "fast"],
  direction: ["left", "right"],
  ground: ["stage", "primary", "light"],
  size: ["small", "medium", "large"],
  separator: ["none", "dot", "star", "line"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof MARQUEE_SETTINGS
type Step<S extends Setting> = (typeof MARQUEE_SETTINGS)[S][number]

/** A new strip's steps, filled where a section has none. */
export const MARQUEE_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  speed: "medium",
  direction: "left",
  ground: "stage",
  size: "medium",
  separator: "dot",
}

export const MARQUEE_LIMITS = { items: { min: 1, max: 8 }, text: 60, subtext: 80 } as const

/** Strips a page shows at most: the header's one counts with the page's own. */
export const MARQUEE_PER_PAGE = 2

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/**
 * A setting's steps: one off the list is a stale or forged editor, refused
 * with the error key (a custom check, as Medusa's answer drops an enum's
 * key, `look.ts`); none is the default.
 */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = MARQUEE_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(MARQUEE_DEFAULTS[name])
}

const item = z
  .object({
    icon: z
      .custom<(typeof TRUST_ICONS)[number]>(
        (value) => (TRUST_ICONS as readonly unknown[]).includes(value),
        SETTING_ERROR
      )
      .nullable()
      .default(null),
    text: shopText(MARQUEE_LIMITS.text),
    subtext: optional(shopText(MARQUEE_LIMITS.subtext)),
    link: optional(storefrontLink),
  })
  .strict()

const fields = {
  type: z.literal("marquee"),
  items: z.array(item).min(MARQUEE_LIMITS.items.min).max(MARQUEE_LIMITS.items.max),
  speed: setting("speed"),
  direction: setting("direction"),
  ground: setting("ground"),
  size: setting("size"),
  separator: setting("separator"),
}

/** On a page's body: the home and product pages', with its look (§6). */
export const marquee = z.object({ ...bodyFields, ...fields }).strict()

/** On a category page: above or below its products. */
export const placedMarquee = marquee.extend({ placement })

/** In the header group, above the shop's header: no look (the header's frame is §9 V3's). */
export const headerMarquee = z.object({ ...base, ...fields }).strict()

export type MarqueeSection = z.infer<typeof marquee>
export type HeaderMarquee = z.infer<typeof headerMarquee>
