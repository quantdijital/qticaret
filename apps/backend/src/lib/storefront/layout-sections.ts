import { z } from "@medusajs/framework/zod"
import { placement } from "./layout-fields"
import { announcementBar } from "./sections/announcement-bar"
import { banner } from "./sections/banner"
import { brands } from "./sections/brands"
import { categories } from "./sections/categories"
import { counted } from "./sections/counted"
import { faq } from "./sections/faq"
import { featuredProduct } from "./sections/featured-product"
import { googleRating } from "./sections/google-rating"
import { hero } from "./sections/hero"
import { heroSlider } from "./sections/hero-slider"
import { categoryMain, footerBar, headerBar, productMain } from "./sections/main"
import type { MainSectionType } from "./sections/main"
import { headerMarquee, marquee, placedMarquee } from "./sections/marquee"
import { products } from "./sections/products"
import { relatedProducts } from "./sections/related-products"
import { richText } from "./sections/rich-text"
import { placedTrustBadges, trustBadges } from "./sections/trust-badges"
import { footerNewsletter, worded } from "./sections/worded"

/**
 * The storefront design's sections (adr/0049), each a type of its own with
 * its settings, and which page group takes which: the header's, the home
 * page's, the product and category pages', the footer's. Sector-free; text
 * is plain (shop details as `{belirteç}`s, adr/0048); images only from the
 * shop's media library; links point at records, never typed paths. No
 * HTML, CSS or scripts. Each type is its own file under `sections/`
 * (adr/0049 Ek 2026-11-14 §2.5), a type with variants a union of its
 * variants' branches (`sections/variants.ts`), every body section with
 * its look (`sections/look.ts`, §6); their pieces are `layout-fields.ts`;
 * the whole document is `layout.ts`.
 */

export { LAYOUT_LIMITS } from "./layout-fields"
export { BEST_SELLER_DAYS } from "./sections/products"
export { announcementBar, footerNewsletter, worded }
export { MARQUEE_PER_PAGE } from "./sections/marquee"

// A type a group does not take (another page's, or none) reads as an unknown section
const SECTION_TYPE = { error: "storefront_layout.section_invalid" }

export const pageSection = z.discriminatedUnion(
  "type",
  [
    hero,
    heroSlider,
    banner,
    categories,
    products,
    featuredProduct,
    brands,
    counted("posts", 6, 3),
    counted("reviews", 12, 6),
    googleRating,
    richText,
    trustBadges,
    worded("newsletter"),
    worded("help"),
    faq,
    marquee,
  ],
  SECTION_TYPE
)

/** On every product page: the product's own block (`product_main`), the others below it. */
export const productSection = z.discriminatedUnion(
  "type",
  [
    productMain,
    relatedProducts,
    richText,
    banner,
    faq,
    trustBadges,
    worded("help"),
    worded("newsletter"),
    marquee,
  ],
  SECTION_TYPE
)

/**
 * On every category page: its product grid (`category_main`, in no order),
 * the others above it or below it (`placement`).
 */
export const categorySection = z.discriminatedUnion(
  "type",
  [
    categoryMain,
    richText.extend({ placement }),
    banner.extend({ placement }),
    faq.extend({ placement }),
    placedTrustBadges,
    worded("help").extend({ placement }),
    worded("newsletter").extend({ placement }),
    placedMarquee,
  ],
  SECTION_TYPE
)

/**
 * On every page but the checkout's: the shop's header bar (`header_bar`),
 * and above it the announcement bar and the scrolling strip; each at most
 * once (adr/0049 Ek 2026-11-14 §5, §10 karar 9).
 */
export const headerSection = z.discriminatedUnion(
  "type",
  [announcementBar, headerMarquee, headerBar],
  SECTION_TYPE
)

/** The shop's footer (`footer_bar`) and its newsletter box, each at most once. */
export const footerSection = z.discriminatedUnion(
  "type",
  [footerNewsletter, footerBar],
  SECTION_TYPE
)

export type PageSection = z.infer<typeof pageSection>
export type ProductSection = z.infer<typeof productSection>
export type CategorySection = z.infer<typeof categorySection>
/** A page's main section (adr/0049 Ek 2026-11-14 §7): the product's block, the category's grid. */
export type PageMain = Extract<ProductSection | CategorySection, { type: MainSectionType }>
/** A section of a page's body, its main one aside: the home, product or category page's. */
export type BodySection = Exclude<PageSection | ProductSection | CategorySection, PageMain>
export type HeaderSection = z.infer<typeof headerSection>
export type FooterSection = z.infer<typeof footerSection>
export type LayoutSection = BodySection | HeaderSection
