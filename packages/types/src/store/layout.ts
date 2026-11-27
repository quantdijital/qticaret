/**
 * The storefront's design as `GET /store/storefront-layout` gives it
 * (adr/0049): the sections showing now, links and images resolved, the
 * shop's details in place. A copy of the backend's answer (adr/0046 §8).
 */
import type { MediaDerivatives } from "./catalog.js"
import type { StoreBannerSection } from "./section-banner.js"
import type { MarqueeSettings } from "./section-marquee.js"
import type { SectionLook } from "./section-look.js"
import type { SectionDevice } from "./section-device.js"
import type { AnnouncementSettings } from "./section-announcement.js"
import type { FaqSettings, StoreFaqItem } from "./section-faq.js"
import type { FeaturedProductSettings } from "./section-featured.js"
import type { StoreMainSections } from "./section-main.js"
import type { StoreHeroSection, StorePriceBandsSection } from "./section-catalog.js"
import type {
  StoreCategoriesCarousel,
  StoreCategoriesCollage,
  StoreCategoriesIcons,
  StoreCategoriesLinked,
  StoreCategoriesPanels,
} from "./section-categories.js"
import type { StoreStripGallerySection } from "./section-strips.js"
import type { StoreStatsSection } from "./section-stats.js"
import type { StoreStepsSection } from "./section-steps.js"
import type { StoreDeparturesSection } from "./section-departures.js"
import type { StoreSearchBoxSection } from "./section-search-box.js"
import type { TrustCardStep } from "./section-trust.js"
import type { StoreNewsletterSection } from "./section-newsletter.js"
import type { StoreRichTextSection } from "./section-rich-text.js"
import type { StorePostsSection } from "./section-posts.js"
import type { ShelfPhoneColumns, StoreProductsSection } from "./section-shelf.js"
import type { StorePhotoCollageSection } from "./section-collage.js"
import type { ReviewsProductImage } from "./section-reviews.js"
import type {
  CardVariant,
  FaqVariant,
  ProgramPlace,
  ProgramVariant,
  RelatedProductsVariant,
  ReviewsVariant,
  TrustBadgesVariant,
} from "./section-variants.js"
import type { ScrollerSettings, SliderSettings } from "./section-scroller.js"
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
  /**
   * Which screens show it (docs/tema/bilesen-standardi §2), only when not
   * everywhere; absent from a backend before the setting. Read with `deviceOf`.
   */
  device?: SectionDevice
}

/**
 * The category cards: today's picture tiles (`tiles`, and absent from a
 * backend before variants) or, as `linked` (adr/0049 Ek 2026-11-15), each
 * category a card with its first subcategories as links, or as `collage`,
 * photo-led cards filling each row, or as `panels`, frameless graphite
 * panels led by their photos, or as `carousel`, picture cards in one row
 * that slides (with `scroller`). A reader takes a
 * variant it does not know as `tiles` and leaves the other's fields unread.
 */
export type StoreCategoriesSection = {
  id: string
  type: "categories"
  title: string | null
  category_ids: string[]
  /** Each tile's product count (`/store/category-counts`); absent from an older backend: none. */
  show_count?: boolean
  /** The link beside the title; none (or absent): the storefront's "every category". */
  more?: StoreLayoutLink | null
} & (
  | { variant?: "tiles" }
  | StoreCategoriesLinked
  | StoreCategoriesCollage
  | StoreCategoriesPanels
  | StoreCategoriesIcons
  | StoreCategoriesCarousel
)

export type StoreLayoutSection = StoreSectionLookPart &
  (
    | StoreHeroSection
    | StoreBannerSection
    | StoreHeroSliderSection
    | StoreCategoriesSection
    | StoreProductsSection
    | StoreFeaturedProductSection
    | { id: string; type: "brands"; title: string | null; brand_ids: string[] }
    | StorePostsSection
    | StoreReviewsSection
    | StoreGoogleRatingSection
    | StoreRichTextSection
    | {
        id: string
        type: "trust_badges"
        /**
         * How the strip is drawn (adr/0049 Ek 2026-11-14 §2); absent from a
         * backend before variants. The storefront reads one it does not know
         * as the default (`variantOf`).
         */
        variant?: TrustBadgesVariant
        /** The `card` variant's lift (adr/0077 §10 Ek); printed only for `card`, read with `trustCardSettingsOf`. */
        lift?: TrustCardStep<"lift">
      }
    | { id: string; type: "help"; title: string | null; text: string | null }
    | StoreNewsletterSection
    | StoreFaqSection
    | StoreMarqueeSection
    | StorePriceBandsSection
    | StoreStripGallerySection
    | StoreStatsSection
    | StoreStepsSection
    | StoreSearchBoxSection
    | StorePhotoCollageSection
    | StoreDeparturesSection
  )

/**
 * The shop's reviews (adr/0077 §10): `variant` and `scroller` only on a
 * `carousel` (a grid prints as it did before variants); the storefront
 * reads an unknown variant as the grid (`variantOf`).
 */
export interface StoreReviewsSection {
  id: string
  type: "reviews"
  title: string | null
  limit: number
  variant?: ReviewsVariant
  scroller?: ScrollerSettings
  /** `carousel` only, while set: the reviewed product's picture on each card (`section-reviews.ts`). */
  product_image?: ReviewsProductImage
}

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
  /** Which screens show it, only when not everywhere (the header's strip has no look part). */
  device?: SectionDevice
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
 * the still `hero`: 2–6 slides, driven by the scroller kit's settings it
 * has use for (bilesen-denetimi (b) 4; `sliderSettingsOf`).
 */
export interface StoreHeroSliderSection {
  id: string
  type: "hero_slider"
  slides: StoreHeroSlide[]
  height: "compact" | "regular"
  /** The kit's settings; absent from a backend before the kit, which sends the four below. */
  scroller?: SliderSettings
  /**
   * Seconds saved before the kit that no speed step keeps (7, 9, 10),
   * printed while they still stand for the speed in force (`sliderSecondsOf`).
   */
  interval?: number
  /** A backend before the kit: still unless on, dots and arrows unless off. */
  autoplay?: boolean
  dots?: boolean
  arrows?: boolean
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

/**
 * One live product up close on the home page (adr/0046 Ek 2026-11-05); the
 * storefront reads it. Its settings (adr/0049 Ek 2026-11-15) are printed
 * only off their default: one absent reads as it (`featuredProductSettingsOf`).
 */
export type StoreFeaturedProductSection = {
  id: string
  type: "featured_product"
  title: string | null
  /** The shop's line about it, its `{tokens}` filled; null: none. */
  text: string | null
  product_id: string
} & Partial<FeaturedProductSettings>

/**
 * Questions and answers (adr/0049 Ek 2026-11-03; adr/0073 Ek 2026-11-24
 * (2)): each row a question with its answer (the backend's HTML, or a
 * plain answer saved before rich answers, its `{tokens}` filled) or a
 * group's heading. Its settings (bilesen-denetimi (b) 8) are printed only
 * when on: one absent reads as its default (`faqSettingsOf`). `variant`
 * only off the default (`standard`), so a section from before variants
 * prints as it did.
 */
export type StoreFaqSection = {
  id: string
  type: "faq"
  title: string | null
  items: StoreFaqItem[]
  /** Absent: `standard`. */
  variant?: FaqVariant
} & Partial<FaqSettings>

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
      /**
       * How the cards stand (bilesen-denetimi (b) 7): printed only for
       * `carousel`; absent, or one this build does not know, reads as `grid`.
       */
      variant?: RelatedProductsVariant
      /** The rail's own card variant; absent: the theme setting's. */
      card_variant?: CardVariant | null
      /** `grid` (and a backend before variants): cards in a row on a wide screen. */
      columns?: ShelfColumns
      /** `grid`: cards in a row on a phone; printed only when not the default (2). */
      columns_mobile?: ShelfPhoneColumns
      /** `carousel`: the scroller kit's settings. */
      scroller?: ScrollerSettings
    })
  | (StoreSectionLookPart & {
      id: string
      /** A dated product's program (adr/0078); needs `catalog.booking` (`section-requires`). */
      type: "program"
      title: string | null
      /** Its own section (`section`, absent) or a tab beside the description (`tab`). */
      place?: ProgramPlace
      /** One this build does not know reads as `timeline`. */
      variant?: ProgramVariant
    })

/** A section of every category page: above the product grid (`top`) or below it. */
export type StoreCategorySection = StorePageSection & { placement: "top" | "bottom" }

/**
 * A section of the footer group (adr/0070 §4): drawn above the shop's
 * footer on every page but the checkout's, as a page's section.
 */
export type StoreFooterSection =
  | StoreNewsletterSection
  | Extract<StoreLayoutSection, { type: "rich_text" | "trust_badges" | "marquee" }>

/** A section of the header group: drawn above the shop's header on every page but the checkout's. */
export type StoreHeaderSection = StoreAnnouncementBar | StoreMarqueeSection

/**
 * The announcement bar: its lines in the shop's words and how it shows more
 * than one (docs/tema/bilesen-denetimi (b) 6). A backend before the settings
 * sends none: the storefront reads each as its default (`announcementSettingsOf`),
 * the first line alone.
 */
export type StoreAnnouncementBar = {
  id: string
  type: "announcement_bar"
  lines: string[]
  /**
   * A small button beside the lines (its words the link's own label);
   * absent or null (today's): none.
   */
  link?: StoreLayoutLink | null
} & Partial<AnnouncementSettings>

export interface StoreLayout {
  /** The announcement bar and the scrolling strip, each at most once (adr/0049 §10 karar 9). */
  header: StoreHeaderSection[]
  home: StoreLayoutSection[]
  /**
   * The footer group above the shop's footer, in its order (adr/0070 §4):
   * the newsletter box, a rich text, trust badges, a scrolling strip, each
   * at most once. A backend before the group sends the box alone.
   */
  footer: StoreFooterSection[]
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
