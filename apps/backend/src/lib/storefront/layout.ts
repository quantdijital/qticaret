import { z } from "@medusajs/framework/zod"
import { contentDoc } from "../content"
import { isHttpsUrl } from "../security/https-url"
import { isCleanText } from "../security/text"
import { unknownShopTokens } from "../shop/tokens"
import { storefrontLink } from "./menus"

/**
 * The storefront's design as the theme editor writes it (adr/0049): the
 * header's, the home page's and the footer's sections, each a type of its
 * own with its settings. Sector-free; text is plain (shop details as
 * `{belirteç}`s, adr/0048); images only from the shop's media library;
 * links point at records, never typed paths. No HTML, CSS or scripts.
 */

export const LAYOUT_LIMITS = { home: 30, header: 3, footer: 3, items: 24, slides: 6 } as const

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

/** An image of the shop's media library; the save checks it is one of its uploads. */
const image = z
  .object({
    url: z
      .string()
      .trim()
      .refine((value) => isHttpsUrl(value) || value.startsWith("/"), {
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

const announcementBar = z
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

const productSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("newest") }).strict(),
  z.object({ kind: z.literal("category"), category_id: recordId }).strict(),
  z.object({ kind: z.literal("collection"), collection_id: recordId }).strict(),
  z
    .object({
      kind: z.literal("manual"),
      product_ids: z.array(recordId).min(1).max(LAYOUT_LIMITS.items),
    })
    .strict(),
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

const worded = (type: "newsletter" | "help") =>
  z.object({ ...base, type: z.literal(type), title, text: optional(shopText(240)) }).strict()

const pageSection = z.discriminatedUnion("type", [
  hero,
  banner,
  categories,
  products,
  brands,
  counted("posts", 6, 3),
  counted("reviews", 12, 6),
  richText,
  trustBadges,
  worded("newsletter"),
  worded("help"),
])

export type PageSection = z.infer<typeof pageSection>
export type HeaderSection = z.infer<typeof announcementBar>
export type FooterSection = z.infer<ReturnType<typeof worded>>
export type LayoutSection = PageSection | HeaderSection

const onlyOnce = (sections: readonly { type: string }[]) =>
  new Set(sections.map((section) => section.type)).size === sections.length

/** The whole design: checked as one, so a section's id is unique across the groups. */
export const layoutDocument = z
  .object({
    header: z.array(announcementBar).max(LAYOUT_LIMITS.header).default([]),
    home: z.array(pageSection).max(LAYOUT_LIMITS.home).default([]),
    footer: z.array(worded("newsletter")).max(LAYOUT_LIMITS.footer).default([]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const all: { id: string; starts_at: string | null; ends_at: string | null }[] = [
      ...doc.header,
      ...doc.home,
      ...doc.footer,
    ]
    if (new Set(all.map((section) => section.id)).size !== all.length) {
      ctx.addIssue({ code: "custom", message: "storefront_layout.section_duplicate" })
    }
    if (!onlyOnce(doc.header) || !onlyOnce(doc.footer)) {
      ctx.addIssue({ code: "custom", message: "storefront_layout.section_duplicate" })
    }
    const backwards = all.some(
      (section) =>
        section.starts_at &&
        section.ends_at &&
        new Date(section.ends_at).getTime() <= new Date(section.starts_at).getTime()
    )
    if (backwards) {
      ctx.addIssue({ code: "custom", message: "storefront_layout.schedule_invalid" })
    }
  })

export type LayoutDocument = z.infer<typeof layoutDocument>

/** Whether a section shows at this moment: visible, and within its dates if it has any. */
export function isShowing(
  section: { visible: boolean; starts_at: string | null; ends_at: string | null },
  now: Date
): boolean {
  const at = now.getTime()
  return (
    section.visible &&
    (!section.starts_at || new Date(section.starts_at).getTime() <= at) &&
    (!section.ends_at || new Date(section.ends_at).getTime() > at)
  )
}
