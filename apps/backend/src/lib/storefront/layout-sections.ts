import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../content"
import { isStorageUrl } from "../security/https-url"
import { isCleanText } from "../security/text"
import { unknownShopTokens } from "../shop/tokens"
import { isShopPath, storefrontLink } from "./menus"

/**
 * The storefront design's sections (adr/0049), each a type of its own with
 * its settings, and which page group takes which: the header's, the home
 * page's, the product and category pages', the footer's. Sector-free; text
 * is plain (shop details as `{belirteç}`s, adr/0048); images only from the
 * shop's media library; links point at records, never typed paths. No
 * HTML, CSS or scripts. The whole document is `layout.ts`.
 */

export const LAYOUT_LIMITS = {
  home: 30,
  product: 12,
  category: 12,
  header: 3,
  footer: 3,
  items: 24,
  slides: 6,
  faq: 12,
  related: 12,
} as const

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => isCleanText(value), { message: "storefront_layout.text_invalid" })

// A line that may stand for the shop's details (adr/0048)
const shopText = (max: number) =>
  text(max).refine((value) => unknownShopTokens(value).length === 0, {
    message: "storefront_layout.token_unknown",
  })

const optional = <T extends z.ZodType>(schema: T) => schema.nullable().default(null)

const recordId = z.string().regex(/^[a-z]+_[0-9A-Za-z]{1,40}$/, {
  message: "storefront_layout.target_invalid",
})

/**
 * An image of the shop's media library: its storage's address (plain http
 * on a developer's machine, https deployed) or a path on the shop; the
 * save checks it is one of its uploads.
 */
const image = z
  .object({
    url: z
      .string()
      .trim()
      .refine((value) => isCleanText(value) && (isStorageUrl(value) || isShopPath(value)), {
        message: "storefront_layout.image_invalid",
      }),
    alt: optional(text(300)),
  })
  .strict()

const base = {
  /** The panel's own id for the section: stable while it is moved. */
  id: z.string().regex(/^[a-z0-9]{6,24}$/, { message: "storefront_layout.section_invalid" }),
  visible: z.boolean().default(true),
  /** Shown only from, and until, these moments (campaigns); none: always. */
  starts_at: optional(z.iso.datetime({ offset: true })),
  ends_at: optional(z.iso.datetime({ offset: true })),
}

const title = optional(text(60))

export const announcementBar = z
  .object({
    ...base,
    type: z.literal("announcement_bar"),
    lines: z.array(shopText(120)).min(1).max(5),
  })
  .strict()

const hero = z
  .object({
    ...base,
    type: z.literal("hero"),
    eyebrow: optional(shopText(40)),
    /** None: the shop's name. */
    heading: optional(shopText(90)),
    text: optional(shopText(240)),
    links: z.array(storefrontLink).max(2).default([]),
    image: optional(image),
  })
  .strict()

const banner = z
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

const categories = z
  .object({
    ...base,
    type: z.literal("categories"),
    title,
    /** None: the top categories. */
    category_ids: z.array(recordId).max(LAYOUT_LIMITS.items).default([]),
  })
  .strict()

const collectionSource = z
  .object({ kind: z.literal("collection"), collection_id: recordId })
  .strict()
const manualSource = (max: number) =>
  z.object({ kind: z.literal("manual"), product_ids: z.array(recordId).min(1).max(max) }).strict()

/** A best-seller rail's window in days (adr/0049 Ek 2026-11-05): a week to a year, a season by default. */
export const BEST_SELLER_DAYS = { min: 7, max: 365, default: 90 } as const

const productSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("newest") }).strict(),
  /** What `/kampanyalar` lists now, the deepest discount first; picked on the server. */
  z.object({ kind: z.literal("on_sale") }).strict(),
  /** The most units sold in paid orders over the last `days`; picked on the server. */
  z
    .object({
      kind: z.literal("best_sellers"),
      days: z
        .number()
        .int()
        .min(BEST_SELLER_DAYS.min)
        .max(BEST_SELLER_DAYS.max)
        .default(BEST_SELLER_DAYS.default),
    })
    .strict(),
  z.object({ kind: z.literal("category"), category_id: recordId }).strict(),
  collectionSource,
  manualSource(LAYOUT_LIMITS.items),
])

const products = z
  .object({
    ...base,
    type: z.literal("products"),
    title,
    source: productSource,
    limit: z.number().int().min(1).max(LAYOUT_LIMITS.items).default(12),
    /** A "see all" link under the rail. */
    more: optional(storefrontLink),
  })
  .strict()

/** One product up close (adr/0046 Ek 2026-11-05): the storefront adds its facts and spec table. */
const featuredProduct = z
  .object({
    ...base,
    type: z.literal("featured_product"),
    title,
    text: optional(shopText(240)),
    product_id: recordId,
  })
  .strict()

const brands = z
  .object({
    ...base,
    type: z.literal("brands"),
    title,
    /** None: every brand, up to the limit. */
    brand_ids: z.array(recordId).max(LAYOUT_LIMITS.items).default([]),
  })
  .strict()

const counted = (type: "posts" | "reviews", max: number, fallback: number) =>
  z
    .object({
      ...base,
      type: z.literal(type),
      title,
      limit: z.number().int().min(1).max(max).default(fallback),
    })
    .strict()

const richText = z
  .object({ ...base, type: z.literal("rich_text"), title, body: contentDoc })
  .strict()

const trustBadges = z.object({ ...base, type: z.literal("trust_badges") }).strict()

export const worded = (type: "newsletter" | "help") =>
  z.object({ ...base, type: z.literal(type), title, text: optional(shopText(240)) }).strict()

/** Questions and answers; the storefront also gives them as `FAQPage` structured data. */
const faq = z
  .object({
    ...base,
    type: z.literal("faq"),
    title,
    items: z
      .array(z.object({ question: text(160), answer: shopText(600) }).strict())
      .min(1)
      .max(LAYOUT_LIMITS.faq),
  })
  .strict()

/** Products shown under a product's own: its category's, a collection's, or chosen ones. */
const relatedProducts = z
  .object({
    ...base,
    type: z.literal("related_products"),
    title,
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("same_category") }).strict(),
      collectionSource,
      manualSource(LAYOUT_LIMITS.related),
    ]),
    limit: z.number().int().min(1).max(LAYOUT_LIMITS.related).default(8),
  })
  .strict()

// A type a group does not take (another page's, or none) reads as an unknown section
const SECTION_TYPE = { error: "storefront_layout.section_invalid" }

export const pageSection = z.discriminatedUnion(
  "type",
  [
    hero,
    banner,
    categories,
    products,
    featuredProduct,
    brands,
    counted("posts", 6, 3),
    counted("reviews", 12, 6),
    richText,
    trustBadges,
    worded("newsletter"),
    worded("help"),
    faq,
  ],
  SECTION_TYPE
)

/** Below the product's own block on every product page. */
export const productSection = z.discriminatedUnion(
  "type",
  [relatedProducts, richText, banner, faq, trustBadges, worded("help"), worded("newsletter")],
  SECTION_TYPE
)

/** Where a category page shows a section: above its product grid or below it. */
const placement = z.enum(["top", "bottom"]).default("bottom")

export const categorySection = z.discriminatedUnion(
  "type",
  [
    richText.extend({ placement }),
    banner.extend({ placement }),
    faq.extend({ placement }),
    trustBadges.extend({ placement }),
    worded("help").extend({ placement }),
    worded("newsletter").extend({ placement }),
  ],
  SECTION_TYPE
)

export type PageSection = z.infer<typeof pageSection>
export type ProductSection = z.infer<typeof productSection>
export type CategorySection = z.infer<typeof categorySection>
/** A section of a page's body: the home, product or category page's. */
export type BodySection = PageSection | ProductSection | CategorySection
export type HeaderSection = z.infer<typeof announcementBar>
export type FooterSection = z.infer<ReturnType<typeof worded>>
export type LayoutSection = BodySection | HeaderSection
