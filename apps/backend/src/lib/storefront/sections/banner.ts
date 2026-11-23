import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, image, optional, placement, shopText } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The picture band, `banner` (adr/0049 Ek 2026-11-14 §3.3 E2): one to six
 * pictures, each with its heading, a line, one or two buttons, its own
 * tone and a phone's own picture; and how the band stands, each a closed
 * list of named steps the theme maps onto its own scale (no number, no
 * colour). Every setting is optional and its default the band as it was
 * drawn before them, so a stored band reads and draws unchanged.
 *
 * Mirrors `@qticaret/types`' `BANNER_SETTINGS`, `BANNER_DEFAULTS` and
 * `BANNER_TONES` (the backend reads no runtime value from that package);
 * a unit test keeps them equal.
 */
export const BANNER_SETTINGS = {
  width: ["boxed", "full"],
  height: ["low", "medium", "high"],
  text_position: [
    "top_left",
    "top_center",
    "top_right",
    "middle_left",
    "middle_center",
    "middle_right",
    "bottom_left",
    "bottom_center",
    "bottom_right",
  ],
  overlay: ["none", "light", "medium", "strong"],
  button_style: ["solid", "outline", "text"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof BANNER_SETTINGS
type Step<S extends Setting> = (typeof BANNER_SETTINGS)[S][number]

/** A band's steps where it has none: as it was drawn before them. */
export const BANNER_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  width: "boxed",
  height: "medium",
  text_position: "bottom_left",
  overlay: "medium",
  button_style: "solid",
}

export const BANNER_TONES = ["light", "dark"] as const

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/**
 * A closed list's step: one off it is a stale or forged editor, refused
 * with the error key (a custom check, as Medusa's answer drops an enum's
 * key, `look.ts`); none is the default.
 */
const step = <T extends string>(steps: readonly T[], fallback: T) => {
  const listed: readonly unknown[] = steps
  return z.custom<T>((value) => listed.includes(value), SETTING_ERROR).default(fallback)
}

const setting = <S extends Setting>(name: S) =>
  step<Step<S>>(BANNER_SETTINGS[name], BANNER_DEFAULTS[name])

const slide = z
  .object({
    image,
    /** A phone's own picture (a closer crop); none: the wide one. */
    mobile_image: optional(image),
    heading: optional(shopText(90)),
    text: optional(shopText(160)),
    link: optional(storefrontLink),
    /** A second, quieter button beside the first. */
    second_link: optional(storefrontLink),
    /** `light`: light words on a dark veil; `dark`: dark words on a light one. */
    tone: step(BANNER_TONES, "light"),
  })
  .strict()

/** What both variants hold, under the same names (switching keeps them). */
const common = {
  ...bodyFields,
  type: z.literal("banner"),
  slides: z.array(slide).min(1).max(LAYOUT_LIMITS.slides),
  width: setting("width"),
  height: setting("height"),
  text_position: setting("text_position"),
  overlay: setting("overlay"),
  button_style: setting("button_style"),
}

/** Today's band: the slides side by side, their words over the pictures. */
const standard = z.object({ ...common, variant: defaultVariant("banner") }).strict()

/**
 * adr/0077 Ek ("Bölünmüş bant"): the first slide's picture beside a panel
 * on the section's ground, an upper line over its heading, the picture's
 * inner edge straight or curved. Mirrors `@qticaret/types`'
 * `BANNER_SPLIT_EDGES` and `BANNER_EYEBROW_MAX`.
 */
export const BANNER_SPLIT_EDGES = ["straight", "curved"] as const

export const BANNER_EYEBROW_MAX = 40

const split = z
  .object({
    ...common,
    variant: z.literal("split"),
    eyebrow: optional(shopText(BANNER_EYEBROW_MAX)),
    edge: step(BANNER_SPLIT_EDGES, "straight"),
  })
  .strict()

/** What a band read as each variant keeps (`storedSection`). */
export const BANNER_BRANCHES: Readonly<Record<SectionVariant<"banner">, VariantBranch>> = {
  standard,
  split,
}

/** On the home, product and content pages. */
export const banner = z.discriminatedUnion("variant", [standard, split], VARIANT_ERROR)

/** On a category page: above or below its products. */
export const placedBanner = z.discriminatedUnion(
  "variant",
  [standard.extend({ placement }), split.extend({ placement })],
  VARIANT_ERROR
)

export type BannerSection = z.infer<typeof banner> | z.infer<typeof placedBanner>

/** Every picture a band shows: each slide's, and a phone's own where it has one. */
export const bannerImages = (section: BannerSection): string[] =>
  section.slides.flatMap((each) =>
    each.mobile_image ? [each.image.url, each.mobile_image.url] : [each.image.url]
  )

/** Every link a band holds: each slide's one or two buttons. */
export const bannerLinks = <L>(section: { slides: { link: L | null; second_link: L | null }[] }) =>
  section.slides.flatMap((each) => [each.link, each.second_link].filter((l): l is L => l !== null))
