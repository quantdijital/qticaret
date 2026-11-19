import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, placement } from "./layout-fields"
import { banner } from "./sections/banner"
import { brands } from "./sections/brands"
import { categories } from "./sections/categories"
import { counted } from "./sections/counted"
import { faq } from "./sections/faq"
import { featuredProduct } from "./sections/featured-product"
import { googleRating } from "./sections/google-rating"
import { placedMarquee } from "./sections/marquee"
import { placedNewsletter } from "./sections/newsletter"
import { products } from "./sections/products"
import { placedRichText } from "./sections/rich-text"
import { stripGallery } from "./sections/strip-gallery"
import { placedTrustBadges } from "./sections/trust-badges"
import { VARIANT_ERROR } from "./sections/variants"
import { worded } from "./sections/worded"

/**
 * A content page's own sections (adr/0073): the pages the shop writes in
 * İçerik take sections from the theme editor, each above the page's text
 * (`top`) or below it (`bottom`, the default), as a category page's stand
 * around its products. The page's head and text are not sections and are
 * not stored. The types are the home page's but its opening (`hero`,
 * `hero_slider`: the page's head owns the h1) and the price bands; their
 * schemas are the home page's, with a place.
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
] as const

// A type a page does not take reads as an unknown section, as in every group
const SECTION_TYPE = { error: "storefront_layout.section_invalid" }

const [tiles, linked, collage, panels] = categories.options
const placedCategories = z.discriminatedUnion(
  "variant",
  [
    tiles.extend({ placement }),
    linked.extend({ placement }),
    collage.extend({ placement }),
    panels.extend({ placement }),
  ],
  VARIANT_ERROR
)

const [grid, carousel, featured, compact, columns, strips, ranked, stageList] = products.options
const placedProducts = z.discriminatedUnion(
  "variant",
  [
    grid.extend({ placement }),
    carousel.extend({ placement }),
    featured.extend({ placement }),
    compact.extend({ placement }),
    columns.extend({ placement }),
    strips.extend({ placement }),
    ranked.extend({ placement }),
    stageList.extend({ placement }),
  ],
  VARIANT_ERROR
)

/** A section of a content page: one of the page's types, with its place. */
export const contentPageSection = z.discriminatedUnion(
  "type",
  [
    placedRichText,
    banner.extend({ placement }),
    stripGallery.extend({ placement }),
    faq.extend({ placement }),
    placedTrustBadges,
    worded("help").extend({ placement }),
    placedNewsletter,
    placedMarquee,
    placedProducts,
    featuredProduct.extend({ placement }),
    placedCategories,
    brands.extend({ placement }),
    counted("posts", 6, 3).extend({ placement }),
    counted("reviews", 12, 6).extend({ placement }),
    googleRating.extend({ placement }),
  ],
  SECTION_TYPE
)

export type ContentPageSection = z.infer<typeof contentPageSection>

/** A content page's id (`content_entry`); a malformed one is a stale or forged editor. */
export const PAGE_ID = /^cnt_[0-9A-Za-z]{1,40}$/

export const pageId = z.string().regex(PAGE_ID, { message: "storefront_layout.page_invalid" })

/**
 * One content page's layout: its id and one to twelve sections. A page
 * whose last section is taken away leaves the group (it is drawn as before
 * and frees its place among the twenty).
 */
export const pageLayout = z
  .object({
    page_id: pageId,
    sections: z
      .array(contentPageSection)
      .min(1, { message: "storefront_layout.page_sections_limit" })
      .max(LAYOUT_LIMITS.page, { message: "storefront_layout.page_sections_limit" }),
  })
  .strict()

export type PageLayout = z.infer<typeof pageLayout>

/** The content pages' layouts: twenty pages at most, each once. */
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
