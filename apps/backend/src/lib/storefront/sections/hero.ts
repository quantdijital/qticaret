import { z } from "@medusajs/framework/zod"
import { image, optional, recordId, shopText, text } from "../layout-fields"
import { bodyFields } from "./look"
import { storefrontLink } from "../menus"
import { HERO_FULL_DEFAULTS, HERO_FULL_LIMITS, HERO_FULL_SETTINGS } from "./hero-full"
import { isCleanText } from "../../security/text"
import { HERO_VIDEO_LIMITS, heroVideoLinkOf } from "./hero-video"
import { handNote } from "./hand-note"
import type { HeroFullSetting, HeroFullStep } from "./hero-full"
import { heroCatalogScroller } from "./scroller"
import { VARIANT_ERROR, defaultVariant } from "./variants"
import type { SectionVariant, VariantBranch } from "./variants"

/**
 * The page's opening: a line above, a heading, a text, up to two buttons
 * and a picture, in every variant (adr/0049 Ek 2026-11-14 §2, option B).
 * `standard` is today's graphite stage; `category_list` (H17, §3.2) sets
 * the same opening as a tile between the shop's category list (with
 * product counts) and two category tiles, with quick links under it;
 * `full_image` (adr/0077 §9) draws the picture as the whole opening.
 *
 * Mirrors `@qticaret/types`' `HERO_CATALOG_LIMITS` (the backend reads no
 * runtime value from that package); a unit test keeps them equal.
 */
export const HERO_CATALOG_LIMITS = {
  list: { min: 4, max: 12, default: 9 },
  listed: 12,
  tiles: 2,
  chips: 4,
  picks: 4,
  pickLabel: 24,
  slides: 6,
} as const

const L = HERO_CATALOG_LIMITS

/** The opening's heading (none: the shop's name), line and up to two buttons; a slide's too. */
const words = {
  heading: optional(shopText(90)),
  text: optional(shopText(240)),
  links: z.array(storefrontLink).max(2).default([]),
}

const common = {
  ...bodyFields,
  type: z.literal("hero"),
  eyebrow: optional(shopText(40)),
  ...words,
  image: optional(image),
}

/**
 * One slide of H17's opening (adr/0049 Ek 2026-11-15): the opening's
 * words, buttons and picture, and where the picture leads. No heading is
 * none here; a slide with neither words nor a picture is refused.
 */
const catalogSlide = z
  .object({ ...words, image: optional(image), link: optional(storefrontLink) })
  .strict()
  .refine(
    (slide) =>
      slide.image !== null ||
      slide.heading !== null ||
      slide.text !== null ||
      slide.links.length > 0,
    { message: "storefront_layout.section_invalid" }
  )

export type HeroCatalogSlide = z.infer<typeof catalogSlide>

/** Today's opening: one graphite stage, the picture beside the words. */
const standard = z.object({ ...common, variant: defaultVariant("hero") }).strict()

/** Where the list's categories come from: the top ones, the header's menu, or the shop's pick. */
const listSource = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("top") }).strict(),
    z.object({ kind: z.literal("menu") }).strict(),
    z
      .object({ kind: z.literal("manual"), category_ids: z.array(recordId).min(1).max(L.listed) })
      .strict(),
  ],
  VARIANT_ERROR
)

/**
 * H17: the list (its rows at most `list_limit`, each with its count when
 * `show_count`), the opening as the middle tile (its products shown small
 * under the button, the lowest of their live prices "from" when
 * `show_price`), up to two category tiles beside it (the shop's picture,
 * else the category's) and up to four quick links under it.
 */
const categoryList = z
  .object({
    ...common,
    variant: z.literal("category_list"),
    list: listSource.default({ kind: "top" }),
    list_limit: z.number().int().min(L.list.min).max(L.list.max).default(L.list.default),
    show_count: z.boolean().default(true),
    tiles: z
      .array(z.object({ category_id: recordId, image: optional(image) }).strict())
      .max(L.tiles)
      .default([]),
    chips: z.array(storefrontLink).max(L.chips).default([]),
    picks: z
      .array(z.object({ product_id: recordId, label: optional(text(L.pickLabel)) }).strict())
      .max(L.picks)
      .default([]),
    show_price: z.boolean().default(true),
    // The opening's slides and how they turn (Ek 2026-11-15); absent: its own fields, one slide
    slides: z.array(catalogSlide).min(1).max(L.slides).optional(),
    scroller: heroCatalogScroller.optional(),
  })
  .strict()

/** A closed list's step: one off it refused with the error key (`banner.ts`), none the default. */
const fullStep = <S extends HeroFullSetting>(name: S) => {
  const listed: readonly unknown[] = HERO_FULL_SETTINGS[name]
  return z
    .custom<HeroFullStep<S>>((value) => listed.includes(value), VARIANT_ERROR)
    .default(HERO_FULL_DEFAULTS[name])
}

const VIDEO_ERROR = { message: "storefront_layout.video_invalid" }

/**
 * A YouTube or Vimeo video's link (`hero-video.ts`): one longer than
 * `HERO_VIDEO_LIMITS.url`, with a control character (a NUL jsonb would
 * refuse) or naming no video refused; kept as the host's own short link
 * built from the id (docs/04: the pasted link itself is not kept, nothing
 * of it but the id is served). The storefront takes the id alone again.
 */
const videoUrl = z
  .string()
  .trim()
  // One refusal for one link: a check that fails stops the ones after it
  .max(HERO_VIDEO_LIMITS.url, { ...VIDEO_ERROR, abort: true })
  .refine((value) => isCleanText(value), { ...VIDEO_ERROR, abort: true })
  .refine((value) => heroVideoLinkOf(value) !== null, VIDEO_ERROR)
  // Only a link the refinements let through gets here: it names a video
  .transform((value) => heroVideoLinkOf(value) ?? value)

/**
 * adr/0077 §9, "Tam görsel": the picture as the whole opening (none: the
 * graphite stage), the words over it or (`image_side: end`) beside it; a
 * second heading line in the shop's colour, the buttons or the shop's one
 * search box (its fields the theme's), and the design's trust badges when
 * `show_trust`. The section holds neither the box's fields nor the badges.
 * A YouTube or Vimeo link (`video_url`) adds a button that plays it in a
 * lightbox, under its own words (`video_label`; none: the theme's).
 */
const fullImage = z
  .object({
    ...common,
    variant: z.literal("full_image"),
    title_accent: optional(shopText(HERO_FULL_LIMITS.title_accent)),
    action: fullStep("action"),
    search_position: fullStep("search_position"),
    height: fullStep("height"),
    scrim: fullStep("scrim"),
    align: fullStep("align"),
    image_side: fullStep("image_side"),
    edge: fullStep("edge"),
    button_tone: fullStep("button_tone"),
    button_icon: fullStep("button_icon"),
    accent_mark: fullStep("accent_mark"),
    ornament: fullStep("ornament"),
    title_mix: fullStep("title_mix"),
    words_place: fullStep("words_place"),
    show_trust: z.boolean().default(false),
    video_url: optional(videoUrl),
    video_label: optional(text(HERO_VIDEO_LIMITS.label)),
    // A short hand note over the heading (`hand-note.ts`)
    note: handNote,
  })
  .strict()

export const HERO_BRANCHES: Readonly<Record<SectionVariant<"hero">, VariantBranch>> = {
  standard,
  category_list: categoryList,
  full_image: fullImage,
}

export const hero = z.discriminatedUnion(
  "variant",
  [standard, categoryList, fullImage],
  VARIANT_ERROR
)

export type HeroSection = z.infer<typeof hero>
export type HeroCatalogSection = Extract<HeroSection, { variant: "category_list" }>
export type HeroFullSection = Extract<HeroSection, { variant: "full_image" }>

/** H17's own slides (none for today's opening or one saved before them). */
export const catalogSlides = (section: HeroSection): HeroCatalogSlide[] =>
  section.variant === "category_list" ? (section.slides ?? []) : []
