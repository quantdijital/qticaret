import { z } from "@medusajs/framework/zod"
import { placement } from "./layout-fields"
import type { ContentPageSection } from "./layout-pages"
import { announcementBar } from "./sections/announcement-bar"
import { banner, placedBanner } from "./sections/banner"
import { brands } from "./sections/brands"
import { categories } from "./sections/categories"
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
import { footerRichText, placedRichText, richText } from "./sections/rich-text"
import { posts } from "./sections/posts"
import { priceBands } from "./sections/price-bands"
import { stats } from "./sections/stats"
import { steps } from "./sections/steps"
import { searchBox } from "./sections/search-box"
import { photoCollage } from "./sections/photo-collage"
import { reviews } from "./sections/reviews"
import { stripGallery } from "./sections/strip-gallery"
import { placedTrustBadges, trustBadges } from "./sections/trust-badges"
import { worded } from "./sections/worded"
import { footerNewsletter, newsletter, placedNewsletter } from "./sections/newsletter"

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
    posts,
    reviews,
    googleRating,
    stats,
    steps,
    searchBox,
    photoCollage,
    richText,
    trustBadges,
    newsletter,
    worded("help"),
    faq,
    marquee,
    priceBands,
    stripGallery,
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
    newsletter,
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
    placedRichText,
    placedBanner,
    faq.extend({ placement }),
    placedTrustBadges,
    worded("help").extend({ placement }),
    placedNewsletter,
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

/**
 * The shop's footer (`footer_bar`) and the sections drawn above it on every
 * page (adr/0070 §4, Shopify's footer group): the newsletter box, a rich
 * text, trust badges and a scrolling strip, each at most once. Their
 * schemas are the page sections'. No picture section here (every page's
 * load): the rich text is the pane only, not `with_image` (adr/0073 §3); a
 * picture inside its text is allowed, like a page's, and is held to the
 * media library check (layout-check.ts).
 */
export const footerSection = z.discriminatedUnion(
  "type",
  [footerNewsletter, footerBar, footerRichText, trustBadges, marquee],
  SECTION_TYPE
)

/** The footer group's sections drawn as a page's body section: all but the bar and the box. */
export const FOOTER_BODY_TYPES = ["rich_text", "trust_badges", "marquee"] as const

export type PageSection = z.infer<typeof pageSection>
export type ProductSection = z.infer<typeof productSection>
export type CategorySection = z.infer<typeof categorySection>
/** A page's main section (adr/0049 Ek 2026-11-14 §7): the product's block, the category's grid. */
export type PageMain = Extract<ProductSection | CategorySection, { type: MainSectionType }>
/**
 * A section of a page's body, its main one aside: the home, product or
 * category page's, or a content page's own (adr/0073).
 */
export type BodySection =
  Exclude<PageSection | ProductSection | CategorySection, PageMain> | ContentPageSection
export type HeaderSection = z.infer<typeof headerSection>
export type FooterSection = z.infer<typeof footerSection>
export type LayoutSection = BodySection | HeaderSection
