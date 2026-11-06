import type { ProductSource, ShelfColumns } from "@qticaret/types"
import type { JSONContent } from "@tiptap/react"
import type { LinkInput } from "@/features/storefront/api/menus"

// The sections of the theme editor's document (adr/0049), by page group

/** A button's or a slide's target: the menus' link (a record, a legal text, a page or an address). */
export type LayoutLink = LinkInput
export type { ProductSource, ShelfColumns }

export interface LayoutImage {
  url: string
  alt: string | null
}

interface SectionBase {
  /** The editor's own id (`^[a-z0-9]{6,24}$`), stable while the section moves. */
  id: string
  visible: boolean
  /** Shown only from, and until, these moments (ISO-8601 with an offset); none: always. */
  starts_at: string | null
  ends_at: string | null
}

export interface HeroSection extends SectionBase {
  type: "hero"
  eyebrow: string | null
  /** None: the shop's name. */
  heading: string | null
  text: string | null
  links: LayoutLink[]
  image: LayoutImage | null
}

/** One slide of the home page's sliding opening. */
export interface HeroSlide {
  image: LayoutImage
  /** A phone's own picture (a closer crop); none: the wide one. */
  mobile_image: LayoutImage | null
  heading: string | null
  text: string | null
  /** The slide's one action. */
  link: LayoutLink | null
  position: "left" | "center" | "right"
  /** `light`: light words on a dark picture; `dark`: dark words on a light one. */
  tone: "light" | "dark"
}

/** The home page's sliding opening (adr/0049 Ek 2026-11-06), an extra to the still hero. */
export interface HeroSliderSection extends SectionBase {
  type: "hero_slider"
  slides: HeroSlide[]
  height: "compact" | "regular"
  /** Off by default: nothing moves by itself unless the shop turns it on. */
  autoplay: boolean
  /** Seconds a slide stays while it plays (5–10). */
  interval: number
  dots: boolean
  arrows: boolean
}

export interface BannerSlide {
  image: LayoutImage
  heading: string | null
  text: string | null
  link: LayoutLink | null
}

export interface BannerSection extends SectionBase {
  type: "banner"
  slides: BannerSlide[]
}

export interface CategoriesSection extends SectionBase {
  type: "categories"
  title: string | null
  /** None: the top categories. */
  category_ids: string[]
}

export interface ProductsSection extends SectionBase {
  type: "products"
  title: string | null
  source: ProductSource
  limit: number
  /** Cards in a row on a wide screen; the theme steps down on narrower ones. */
  columns: ShelfColumns
  /** A "see all" link under the rail. */
  more: LayoutLink | null
}

/** One product up close (adr/0046 Ek 2026-11-05): the storefront adds its facts and spec table. */
export interface FeaturedProductSection extends SectionBase {
  type: "featured_product"
  title: string | null
  /** A line about it; may hold the shop's details (`{telefon}`). */
  text: string | null
  /** Empty: none chosen yet (the save waits for one). */
  product_id: string
}

export interface BrandsSection extends SectionBase {
  type: "brands"
  title: string | null
  /** None: every brand. */
  brand_ids: string[]
}

export interface CountedSection extends SectionBase {
  type: "posts" | "reviews"
  title: string | null
  limit: number
}

/**
 * The home page's Google rating badge (adr/0058 Ek 2026-11-06): Google's
 * average and count from the shop's Business Profile, shown only while
 * the shop's Google reviews are connected and there are some.
 */
export interface GoogleRatingSection extends SectionBase {
  type: "google_rating"
  title: string | null
  /** Recent 4–5 star excerpts under the badge: 0 (off) to 3. */
  excerpts: number
  /** "Google'da gör": the place on Google Maps. */
  profile_link: boolean
}

export interface RichTextSection extends SectionBase {
  type: "rich_text"
  title: string | null
  /** The content editor's document (adr/0019). */
  body: JSONContent
}

export interface TrustBadgesSection extends SectionBase {
  type: "trust_badges"
}

export interface WordedSection extends SectionBase {
  type: "newsletter" | "help"
  title: string | null
  text: string | null
}

export interface FaqItem {
  /** Plain text. */
  question: string
  /** Plain text; may hold the shop's details (`{telefon}`). */
  answer: string
}

/** Questions and answers; the storefront also gives them as `FAQPage` structured data. */
export interface FaqSection extends SectionBase {
  type: "faq"
  title: string | null
  items: FaqItem[]
}

/** Products under a product's own: its category's (the storefront finds it), a collection's or chosen ones. */
export type RelatedSource =
  | { kind: "same_category" }
  | { kind: "collection"; collection_id: string }
  | { kind: "manual"; product_ids: string[] }

export interface RelatedProductsSection extends SectionBase {
  type: "related_products"
  title: string | null
  source: RelatedSource
  limit: number
  columns: ShelfColumns
}

export type HomeSection =
  | HeroSection
  | HeroSliderSection
  | BannerSection
  | CategoriesSection
  | ProductsSection
  | FeaturedProductSection
  | BrandsSection
  | CountedSection
  | GoogleRatingSection
  | RichTextSection
  | TrustBadgesSection
  | WordedSection
  | FaqSection

export type HomeSectionType = HomeSection["type"]

/** Under the product's own block, on every product page. */
export type ProductSection =
  | RelatedProductsSection
  | RichTextSection
  | BannerSection
  | FaqSection
  | TrustBadgesSection
  | WordedSection

/** Where a category page shows a section: above its product grid or below it. */
export type Placement = "top" | "bottom"

/** On every category page, above or below the products. */
export type CategorySection = (
  RichTextSection | BannerSection | FaqSection | TrustBadgesSection | WordedSection
) & { placement: Placement }

export interface AnnouncementBar extends SectionBase {
  type: "announcement_bar"
  lines: string[]
}

export interface FooterNewsletter extends SectionBase {
  type: "newsletter"
  title: string | null
  text: string | null
}

export interface LayoutDocument {
  header: AnnouncementBar[]
  home: HomeSection[]
  footer: FooterNewsletter[]
  product: ProductSection[]
  category: CategorySection[]
}

export type LayoutGroup = keyof LayoutDocument
/** The groups that make a page's body: sections are added, moved and copied in them. */
export type BodyGroup = "home" | "product" | "category"
export type BodySection = HomeSection | ProductSection | CategorySection
export type BodySectionType = BodySection["type"]
export type AnySection = AnnouncementBar | BodySection | FooterNewsletter
