/**
 * The storefront's design as `GET /store/storefront-layout` gives it
 * (adr/0049): the sections showing now, links and images resolved, the
 * shop's details in place. A copy of the backend's answer (adr/0046 §8).
 */
import type { MediaDerivatives } from "./catalog.js"
import type { StoreBannerSection } from "./section-banner.js"
import type { MarqueeSettings } from "./section-marquee.js"
import type { SectionLook } from "./section-look.js"
import type { StoreMainSections } from "./section-main.js"
import type { StoreHeroSection, StorePriceBandsSection } from "./section-catalog.js"
import type { CardVariant, TrustBadgesVariant } from "./section-variants.js"
import type {
  MenuLinkKind,
  StoreMenu,
  StoreThemeSettings,
  StorefrontFrame,
  TrustIcon,
} from "./storefront.js"

export interface StoreLayoutLink {
  /** The shop's wording, else the record's name; null: the storefront's own name. */
  label: string | null
  kind: MenuLinkKind
  target: string | null
  /** The record's live path or the address; null: a storefront page or a legal text. */
  path: string | null
}

export interface StoreLayoutImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: MediaDerivatives | null
}

/**
 * Where a rail takes its products from. `on_sale` (what `/kampanyalar`
 * lists, the deepest discount first) and `best_sellers` (the most units
 * sold in paid orders over the last `days`, 7–365) are picked by the
 * backend (adr/0049 Ek 2026-11-05); the storefront fetches the others.
 */
export type ProductSource =
  | { kind: "newest" }
  | { kind: "on_sale" }
  | { kind: "best_sellers"; days: number }
  | { kind: "category"; category_id: string }
  | { kind: "collection"; collection_id: string }
  | { kind: "manual"; product_ids: string[] }

/**
 * How many cards a product rail stands in a row on a wide screen (adr/0049
 * Ek 2026-11-05, grid columns); 3 by default. The theme steps down on
 * narrower screens.
 */
export type ShelfColumns = 3 | 4 | 5

/**
 * What every body section may carry beside its own fields: its look
 * (adr/0049 Ek 2026-11-14 §6), only when the shop set a step; absent, the
 * theme's own drawing (and from a backend before looks). The storefront
 * reads it forgivingly (`lookOf`).
 */
export interface StoreSectionLookPart {
  look?: SectionLook
}

export type StoreLayoutSection = StoreSectionLookPart &
  (
    | StoreHeroSection
    | StoreBannerSection
    | StoreHeroSliderSection
    | {
        id: string
        type: "categories"
        title: string | null
        category_ids: string[]
        /** Each tile's product count (`/store/category-counts`); absent from an older backend: none. */
        show_count?: boolean
        /** The link beside the title; none (or absent): the storefront's "every category". */
        more?: StoreLayoutLink | null
      }
    | {
        id: string
        type: "products"
        title: string | null
        source: ProductSource
        limit: number
        columns: ShelfColumns
        more: StoreLayoutLink | null
        /** The rail's own card variant; null or absent (an older backend): the theme setting's. */
        card_variant?: CardVariant | null
        /** A sale or best-seller rail's products, picked in order; absent for the other sources. */
        product_ids?: string[]
        /** A best-seller rail with too few sales, its rest the newest products; no counts shown. */
        filled_with_newest?: boolean
      }
    | StoreFeaturedProductSection
    | { id: string; type: "brands"; title: string | null; brand_ids: string[] }
    | { id: string; type: "posts" | "reviews"; title: string | null; limit: number }
    | StoreGoogleRatingSection
    | { id: string; type: "rich_text"; title: string | null; html: string }
    | {
        id: string
        type: "trust_badges"
        /**
         * How the strip is drawn (adr/0049 Ek 2026-11-14 §2); absent from a
         * backend before variants. The storefront reads one it does not know
         * as the default (`variantOf`).
         */
        variant?: TrustBadgesVariant
      }
    | { id: string; type: "newsletter" | "help"; title: string | null; text: string | null }
    | StoreFaqSection
    | StoreMarqueeSection
    | StorePriceBandsSection
  )

/**
 * The scrolling strip (adr/0049 Ek 2026-11-14 §4.1): on the home, product
 * and category pages, and at most one in the header above the shop's
 * header. Its items' words filled, their links placed (a broken one null);
 * its settings as the contract lists them, read forgivingly by the
 * storefront (`marqueeSettingsOf`): a setting a backend before it lacks reads
 * as its default. Absent from a backend before the strip.
 */
export type StoreMarqueeSection = {
  id: string
  type: "marquee"
  items: StoreMarqueeItem[]
} & MarqueeSettings

export interface StoreMarqueeItem {
  icon: TrustIcon | null
  text: string
  subtext: string | null
  link: StoreLayoutLink | null
}

/**
 * The home page's Google rating badge (adr/0058 Ek 2026-11-06): its
 * options only; the storefront reads Google's figures and the excerpts
 * from `GET /store/google-reviews` and draws nothing while there are none.
 */
export interface StoreGoogleRatingSection {
  id: string
  type: "google_rating"
  /** None: the storefront's own. */
  title: string | null
  /** Recent 4–5 star excerpts under the badge: 0 (none) to 3. */
  excerpts: number
  /** A link to the place on Google Maps beside the one to `/yorumlar`. */
  profile_link: boolean
}

/**
 * The home page's sliding opening (adr/0049 Ek 2026-11-06), an extra to
 * the still `hero`: 2–6 slides, still unless `autoplay` (every
 * `interval` seconds, 5–10).
 */
export interface StoreHeroSliderSection {
  id: string
  type: "hero_slider"
  slides: StoreHeroSlide[]
  height: "compact" | "regular"
  autoplay: boolean
  interval: number
  dots: boolean
  arrows: boolean
}

export interface StoreHeroSlide {
  image: StoreLayoutImage
  /** A phone's own picture; null: the wide one. */
  mobile_image: StoreLayoutImage | null
  heading: string | null
  text: string | null
  /** The slide's one action; a broken one is null. */
  link: StoreLayoutLink | null
  position: "left" | "center" | "right"
  /** `light`: light words on a dark picture; `dark`: dark words on a light one. */
  tone: "light" | "dark"
}

/** One live product up close on the home page (adr/0046 Ek 2026-11-05); the storefront reads it. */
export interface StoreFeaturedProductSection {
  id: string
  type: "featured_product"
  title: string | null
  /** The shop's line about it, its `{tokens}` filled; null: none. */
  text: string | null
  product_id: string
}

/** Questions and answers in plain text, the answers' `{tokens}` already filled (adr/0049 Ek 2026-11-03). */
export interface StoreFaqSection {
  id: string
  type: "faq"
  title: string | null
  items: { question: string; answer: string }[]
}

/**
 * Where a product page's related rail takes its products from: the
 * product's own category (the storefront works it out), a collection, or
 * the shop's choice (only live products left in it).
 */
export type RelatedSource =
  | { kind: "same_category" }
  | { kind: "collection"; collection_id: string }
  | { kind: "manual"; product_ids: string[] }

/** The kinds every product and category page may hold (adr/0049 Ek 2026-11-03). */
export type StorePageSection = Extract<
  StoreLayoutSection,
  { type: "rich_text" | "banner" | "faq" | "trust_badges" | "help" | "newsletter" | "marquee" }
>

/** A section below every product's own block. */
export type StoreProductSection =
  | StorePageSection
  | (StoreSectionLookPart & {
      id: string
      type: "related_products"
      title: string | null
      source: RelatedSource
      limit: number
      columns: ShelfColumns
    })

/** A section of every category page: above the product grid (`top`) or below it. */
export type StoreCategorySection = StorePageSection & { placement: "top" | "bottom" }

/** A section of the header group: drawn above the shop's header on every page but the checkout's. */
export type StoreHeaderSection =
  { id: string; type: "announcement_bar"; lines: string[] } | StoreMarqueeSection

export interface StoreLayout {
  /** The announcement bar and the scrolling strip, each at most once (adr/0049 §10 karar 9). */
  header: StoreHeaderSection[]
  home: StoreLayoutSection[]
  footer: { id: string; type: "newsletter"; title: string | null; text: string | null }[]
  product: StoreProductSection[]
  category: StoreCategorySection[]
  /**
   * The main sections (adr/0049 Ek 2026-11-14 §5, §7), out of the groups
   * above. Absent from a backend before them: the storefront reads the
   * theme's `header` and draws every default.
   */
  main?: StoreMainSections
  /**
   * The theme's shared settings (adr/0049 Ek 2026-11-06), applied: the
   * design's own, else the storefront settings' old fields. Absent from a
   * backend before them: the storefront reads `StorefrontFrame`'s.
   */
  settings?: StoreLayoutSettings
}

/**
 * What several pages draw alike: the trust badges (details filled) and the
 * colour names; and since adr/0063 §3 the theme's settings and, on a
 * preview, the menu set the draft would put live.
 */
export interface StoreLayoutSettings {
  trust_badges: StorefrontFrame["trust_badges"]
  color_swatches: StorefrontFrame["color_swatches"]
  /**
   * The theme's choices as the design holds them (else the theme section's,
   * applied). Absent from a backend before adr/0063: `StorefrontAnswer.theme`.
   */
  theme?: StoreThemeSettings
  /**
   * The menus a preview's draft would put live, printed as `GET
   * /store/storefront-menus` prints the live ones; null (or absent): the
   * live menus stand. Never set on the published design.
   */
  menus?: StoreMenu[] | null
}
