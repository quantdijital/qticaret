import type {
  MarqueeSettings,
  ProductSource,
  SectionLook,
  ShelfColumns,
  TrustBadgesVariant,
} from "@qticaret/types"
import type { JSONContent } from "@tiptap/react"
import type { TrustIcon } from "@/features/settings/api/sections"
import type { MenuInput } from "@/features/storefront/api/menus"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { LinkInput } from "@/features/storefront/api/menus"
import type {
  CategoryMainSection,
  FooterBarSection,
  HeaderBarSection,
  MainSection,
  ProductMainSection,
} from "@/features/storefront/api/layout-main"

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

/**
 * What a page's body section has beside: its look (adr/0049 Ek 2026-11-14
 * §6), absent until the shop sets a step, each step `null` for the
 * theme's own. The header's bar and the footer's box have none.
 */
interface BodySectionBase extends SectionBase {
  look?: SectionLook
}

export interface HeroSection extends BodySectionBase {
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
export interface HeroSliderSection extends BodySectionBase {
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

export interface BannerSection extends BodySectionBase {
  type: "banner"
  slides: BannerSlide[]
}

export interface CategoriesSection extends BodySectionBase {
  type: "categories"
  title: string | null
  /** None: the top categories. */
  category_ids: string[]
}

export interface ProductsSection extends BodySectionBase {
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
export interface FeaturedProductSection extends BodySectionBase {
  type: "featured_product"
  title: string | null
  /** A line about it; may hold the shop's details (`{telefon}`). */
  text: string | null
  /** Empty: none chosen yet (the save waits for one). */
  product_id: string
}

export interface BrandsSection extends BodySectionBase {
  type: "brands"
  title: string | null
  /** None: every brand. */
  brand_ids: string[]
}

export interface CountedSection extends BodySectionBase {
  type: "posts" | "reviews"
  title: string | null
  limit: number
}

/**
 * The home page's Google rating badge (adr/0058 Ek 2026-11-06): Google's
 * average and count from the shop's Business Profile, shown only while
 * the shop's Google reviews are connected and there are some.
 */
export interface GoogleRatingSection extends BodySectionBase {
  type: "google_rating"
  title: string | null
  /** Recent 4–5 star excerpts under the badge: 0 (off) to 3. */
  excerpts: number
  /** "Google'da gör": the place on Google Maps. */
  profile_link: boolean
}

export interface RichTextSection extends BodySectionBase {
  type: "rich_text"
  title: string | null
  /** The content editor's document (adr/0019). */
  body: JSONContent
}

export interface TrustBadgesSection extends BodySectionBase {
  type: "trust_badges"
  /** How the strip is drawn (adr/0049 Ek 2026-11-14 §2); the server fills the default on reading. */
  variant: TrustBadgesVariant
}

export interface WordedSection extends BodySectionBase {
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

/** Questions and answers, shown on the page; never `FAQPage` structured data (docs/13 §5). */
export interface FaqSection extends BodySectionBase {
  type: "faq"
  title: string | null
  items: FaqItem[]
}

/** Products under a product's own: its category's (the storefront finds it), a collection's or chosen ones. */
export type RelatedSource =
  | { kind: "same_category" }
  | { kind: "collection"; collection_id: string }
  | { kind: "manual"; product_ids: string[] }

export interface RelatedProductsSection extends BodySectionBase {
  type: "related_products"
  title: string | null
  source: RelatedSource
  limit: number
  columns: ShelfColumns
}

/** One item of a scrolling strip: an optional icon, its line, an optional second line and link. */
export interface MarqueeItem {
  /** One of the trust badges' icons; none: no icon. */
  icon: TrustIcon | null
  /** Plain text; may hold the shop's details (`{telefon}`). */
  text: string
  subtext: string | null
  link: LayoutLink | null
}

/** What every scrolling strip has, on a page or in the header (adr/0049 Ek 2026-11-14 §4.1). */
type MarqueeFields = { type: "marquee"; items: MarqueeItem[] } & MarqueeSettings

/** A scrolling strip on a page's body: its look beside. */
export type MarqueeSection = BodySectionBase & MarqueeFields

/** The header group's scrolling strip, above the shop's header: no look. */
export type HeaderMarquee = SectionBase & MarqueeFields

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
  | MarqueeSection

export type HomeSectionType = HomeSection["type"]

/** Under the product's own block, on every product page. */
export type ProductSection =
  | RelatedProductsSection
  | RichTextSection
  | BannerSection
  | FaqSection
  | TrustBadgesSection
  | WordedSection
  | MarqueeSection

/** Where a category page shows a section: above its product grid or below it. */
export type Placement = "top" | "bottom"

/** On every category page, above or below the products. */
export type CategorySection = (
  RichTextSection | BannerSection | FaqSection | TrustBadgesSection | WordedSection | MarqueeSection
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

/** One of the shop's promises, with its icon (the storefront draws it). */
export interface TrustBadge {
  icon: TrustIcon
  title: string
  text: string | null
}

/**
 * The theme's shared settings (adr/0049 Ek 2026-11-06): what several pages
 * draw alike, drafted and published with the sections. The server fills a
 * part not yet written here from Vitrin tercihleri's old field, so the
 * editor always opens every part.
 */
export interface LayoutSettings {
  /** The home, product and category pages' strip, the product page's assurances, the cart. */
  trust_badges: TrustBadge[]
  /** Colour names an option or filter value shows as a swatch for. */
  color_swatches: { label: string; hex: string }[]
  /** "Az kaldı" on a product card at `threshold` units or fewer, never the number. */
  low_stock: { enabled: boolean; threshold: number }
  /**
   * The theme's settings (adr/0063 §3): drafted, previewed and published
   * with the design. The server fills them from the theme section until
   * the shop writes them here.
   */
  theme: ThemeSettings
  /**
   * Menus that replace the shop's when the design is published (adr/0063
   * §3), then cleared from the draft; null: the menus are left alone. The
   * editor carries a set (a restored revision's) and may drop it, never
   * edits one: menus are the Menüler screen's.
   */
  menus: MenuInput[] | null
}

/** The header: the announcement bar, the scrolling strip and the shop's bar, each at most once. */
export type HeaderSection = AnnouncementBar | HeaderMarquee | HeaderBarSection
export type FooterSection = FooterNewsletter | FooterBarSection

/** Each group's sections; the product and category pages' main one beside their body (`BodySection`). */
export interface LayoutDocument {
  header: HeaderSection[]
  home: HomeSection[]
  footer: FooterSection[]
  product: (ProductMainSection | ProductSection)[]
  category: (CategoryMainSection | CategorySection)[]
  settings: LayoutSettings
}

/** The document's section groups (its settings are not one). */
export type LayoutGroup = Exclude<keyof LayoutDocument, "settings">
/** The groups that make a page's body: sections are added, moved and copied in them. */
export type BodyGroup = "home" | "product" | "category"
export type BodySection = HomeSection | ProductSection | CategorySection
export type BodySectionType = BodySection["type"]
export type AnySection = HeaderSection | BodySection | FooterSection | MainSection
/** What takes a look (adr/0049 Ek 2026-11-14 §6): a page's body section and its main one. */
export type LookedSection = BodySection | ProductMainSection | CategoryMainSection
