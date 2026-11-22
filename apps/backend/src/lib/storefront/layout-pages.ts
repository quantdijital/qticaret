import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS } from "./layout-fields"
import { banner } from "./sections/banner"
import { brands } from "./sections/brands"
import { categories } from "./sections/categories"
import { counted } from "./sections/counted"
import { faq } from "./sections/faq"
import { featuredProduct } from "./sections/featured-product"
import { googleRating } from "./sections/google-rating"
import { marquee } from "./sections/marquee"
import { newsletter } from "./sections/newsletter"
import { contact, pageOnlyOnce, paymentFacts, shippingFacts } from "./sections/page-text"
import { products } from "./sections/products"
import { pageRichText } from "./sections/rich-text"
import { stats } from "./sections/stats"
import { steps } from "./sections/steps"
import { photoCollage } from "./sections/photo-collage"
import { reviews } from "./sections/reviews"
import { stripGallery } from "./sections/strip-gallery"
import { trustBadges } from "./sections/trust-badges"
import { worded } from "./sections/worded"

/**
 * A content page's own sections (adr/0073, Ek 2026-11-19 (2) K1): one
 * ordered list per page, drawn in its order under the page's head (trail,
 * the one h1, the cover: not a section). The page's text is among them as
 * sections (`rich_text` as `article`, the contact page's `contact`), with
 * the live payment and shipping facts. The other types are the home
 * page's but its opening (`hero`, `hero_slider`: the page's head owns the
 * h1) and the price bands; their schemas are the home page's.
 *
 * Mirrors `@qticaret/types`' `CONTENT_PAGE_SECTION_TYPES` and
 * `PAGE_LAYOUT_LIMITS`; a unit test keeps them equal.
 */

export const CONTENT_PAGE_SECTION_TYPES = [
  "rich_text",
  "banner",
  "strip_gallery",
  "faq",
  "trust_badges",
  "help",
  "newsletter",
  "marquee",
  "products",
  "featured_product",
  "categories",
  "brands",
  "posts",
  "reviews",
  "google_rating",
  "stats",
  "steps",
  "photo_collage",
  "contact",
  "payment_facts",
  "shipping_facts",
] as const

// A type a page does not take reads as an unknown section, as in every group
const SECTION_TYPE = { error: "storefront_layout.section_invalid" }

/** A section of a content page: one of the page's types. */
export const contentPageSection = z.discriminatedUnion(
  "type",
  [
    pageRichText,
    banner,
    stripGallery,
    faq,
    trustBadges,
    worded("help"),
    newsletter,
    marquee,
    products,
    featuredProduct,
    categories,
    brands,
    counted("posts", 6, 3),
    reviews,
    googleRating,
    stats,
    steps,
    photoCollage,
    contact,
    paymentFacts,
    shippingFacts,
  ],
  SECTION_TYPE
)

export type ContentPageSection = z.infer<typeof contentPageSection>

/** A content page's id (`content_entry`); a malformed one is a stale or forged editor. */
export const PAGE_ID = /^cnt_[0-9A-Za-z]{1,40}$/

export const pageId = z.string().regex(PAGE_ID, { message: "storefront_layout.page_invalid" })

/**
 * One content page's layout: its id and one to twelve sections, its text
 * sections among them; the page's own types (contact, the facts) once
 * each. A page whose last section is taken away leaves the group (its
 * text is then drawn from its mirror, K1).
 */
export const pageLayout = z
  .object({
    page_id: pageId,
    sections: z
      .array(contentPageSection)
      .min(1, { message: "storefront_layout.page_sections_limit" })
      .max(LAYOUT_LIMITS.page, { message: "storefront_layout.page_sections_limit" })
      .refine(pageOnlyOnce, { message: "storefront_layout.section_duplicate" }),
  })
  .strict()

export type PageLayout = z.infer<typeof pageLayout>

/** The content pages' layouts: fifty pages at most, each once. */
export const pagesGroup = z
  .array(pageLayout)
  .max(LAYOUT_LIMITS.pages, { message: "storefront_layout.pages_limit" })
  .refine((pages) => new Set(pages.map((page) => page.page_id)).size === pages.length, {
    message: "storefront_layout.page_duplicate",
  })
  .default([])

/** Every section the pages hold, in order. */
export const pageSections = (pages: readonly PageLayout[]): ContentPageSection[] =>
  pages.flatMap((page) => page.sections)
