import type {
  AnnouncementSettings,
  BannerSettings,
  BannerSplitEdge,
  BannerTone,
  BannerVariant,
  CardVariant,
  FaqSettings,
  FeaturedProductSettings,
  MarqueeSettings,
  ProductSource,
  RelatedProductsVariant,
  ReviewsVariant,
  ScrollerSettings,
  SectionDevice,
  SectionLook,
  ShelfColumns,
  ShelfPhoneColumns,
  SliderSettings,
  NewsletterVariant,
  PageTextSwitch,
  PostsVariant,
  RichTextImageSide,
  RichTextVariant,
  TrustBadgesVariant,
  TrustCardStep,
} from "@qticaret/types"
import type { JSONContent } from "@tiptap/react"
import type { TrustIcon } from "@/features/settings/api/sections"
import type {
  CategoriesCollageFields,
  CategoriesPanelsFields,
  CategoriesIconsFields,
  CategoriesLinkedFields,
} from "@/features/storefront/api/layout-cards"
import type { HeroCatalogFields, PriceBand } from "@/features/storefront/api/layout-catalog"
import type { ProductsSection } from "@/features/storefront/api/layout-shelf"
import type { StripGallerySection } from "@/features/storefront/api/layout-strips"
import type {
  PhotoCollageSection,
  StatsSection,
  StepsSection,
} from "@/features/storefront/api/layout-points"
import type { SearchBoxSection } from "@/features/storefront/api/layout-search-box"
import type { MenuInput } from "@/features/storefront/api/menus"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { LinkInput } from "@/features/storefront/api/menus"
import type { ContentPageSection, PageLayout } from "@/features/storefront/api/layout-pages"
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
export interface BodySectionBase extends SectionBase {
  look?: SectionLook
  /**
   * Which screens show it (docs/tema/bilesen-standardi §2): the server fills
   * `all` on reading; absent in a section the editor just made, read as `all`.
   */
  device?: SectionDevice
}

/** The opening's words, buttons and picture, the same in every variant (adr/0049 Ek 2026-11-14 §2). */
interface HeroBase extends BodySectionBase {
  type: "hero"
  eyebrow: string | null
  /** None: the shop's name. */
  heading: string | null
  text: string | null
  links: LayoutLink[]
  image: LayoutImage | null
}

/** Today's graphite opening, or H17's category list with its own fields. */
export type HeroSection = HeroBase & ({ variant: "standard" } | HeroCatalogFields)

/** The price bands strip: 2–4 rising bands, each band's products picked on the server. */
export interface PriceBandsSection extends BodySectionBase {
  type: "price_bands"
  title: string | null
  bands: PriceBand[]
  /** Products shown small in each band (0–4). */
  thumbs: number
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
  /**
   * The scroller kit's settings a slider has use for (bilesen-denetimi (b)
   * 4); the server fills them on reading, a slider saved before the kit too.
   */
  scroller?: SliderSettings
  /** Seconds saved before the kit that no speed step keeps; dropped once the shop picks a speed. */
  interval?: number
  /** A slider's switches from before the kit; the server reads them into `scroller`. */
  autoplay?: boolean
  dots?: boolean
  arrows?: boolean
}

/** One picture of the band (adr/0049 Ek 2026-11-14 §3.3 E2). */
export interface BannerSlide {
  image: LayoutImage
  /** A phone's own picture (a closer crop); none: the wide one. */
  mobile_image: LayoutImage | null
  heading: string | null
  text: string | null
  link: LayoutLink | null
  /** A second, quieter button. */
  second_link: LayoutLink | null
  tone: BannerTone
}

/** The picture band: its slides and how the whole band stands. */
export type BannerSection = BodySectionBase & {
  type: "banner"
  slides: BannerSlide[]
  /**
   * How it is drawn (adr/0077 Ek): `standard`, today's slides; `split`, the
   * first slide's picture beside a panel. The server fills the default on reading.
   */
  variant: BannerVariant
  /** `split`: the line above the heading. */
  eyebrow?: string | null
  /** `split`: the picture's inner edge. */
  edge?: BannerSplitEdge
} & BannerSettings

interface CategoriesBase extends BodySectionBase {
  type: "categories"
  title: string | null
  /** None: the top categories. */
  category_ids: string[]
  /** Each card's product count. */
  show_count: boolean
  /** The link beside the title; none: "every category". */
  more: LayoutLink | null
}

/** Today's picture tiles, the linked cards, the collage or the panels, each with its own fields (adr/0049). */
export type CategoriesSection = CategoriesBase &
  (
    | { variant: "tiles" }
    | CategoriesLinkedFields
    | CategoriesCollageFields
    | CategoriesPanelsFields
    | CategoriesIconsFields
  )

/**
 * One product up close (adr/0046 Ek 2026-11-05): the storefront adds its
 * facts and spec table. Its photographs layout (adr/0049 Ek 2026-11-15) is
 * filled on reading; one absent reads as the collage (`featuredProductSettingsOf`).
 */
export interface FeaturedProductSection extends BodySectionBase, Partial<FeaturedProductSettings> {
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

/**
 * The newest posts (adr/0077 Ek): today's tiles, or one panel with an
 * upper line, an intro and a button beside the cards. The server fills
 * `grid` on reading.
 */
export interface PostsSection extends BodySectionBase {
  type: "posts"
  title: string | null
  limit: number
  variant: PostsVariant
  /** `intro_panel`: the line above the heading. */
  eyebrow?: string | null
  /** `intro_panel`: the words under the heading. */
  intro?: string | null
  /** `intro_panel`: the button; none: the storefront's "every post". */
  link?: LayoutLink | null
}

/** The shop's newest reviews (adr/0077 §10): today's grid, or one card each in a sliding row. */
export interface ReviewsSection extends BodySectionBase {
  type: "reviews"
  title: string | null
  limit: number
  /** The server fills `grid` on reading. */
  variant: ReviewsVariant
  /** `carousel`: the scroller kit's settings. */
  scroller?: ScrollerSettings
}

/** The latest posts or reviews: a title and how many. */
export type CountedSection = PostsSection | ReviewsSection

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
  /**
   * How it is drawn (adr/0073 §3): `pane`, today's; `with_image`, a picture
   * beside it (the footer group's is the pane only); `article`, a content
   * page's own text (Ek 2026-11-19 (2) K2, the pages' only). The server
   * fills the default on reading.
   */
  variant: RichTextVariant
  /** `with_image`: the media library's picture; null only while the shop has not picked one (`imageRequired`). */
  image?: LayoutImage | null
  /** `with_image`: the picture's side from 1024 px. */
  image_side?: RichTextImageSide
  /** `article`: the outline beside a long text (`auto`, the default) or none. */
  outline?: PageTextSwitch
  /** `article`: a questions-and-answers text read as grouped questions (`auto`) or not. */
  questions?: PageTextSwitch
}

/**
 * How the strip is drawn (adr/0049 Ek 2026-11-14 §2; the server fills the
 * default on reading); the card with its lift (adr/0077 §10 Ek).
 */
export type TrustBadgesSection = BodySectionBase & { type: "trust_badges" } & (
    | { variant: Exclude<TrustBadgesVariant, "card"> }
    | { variant: "card"; lift: TrustCardStep<"lift"> }
  )

export interface HelpSection extends BodySectionBase {
  type: "help"
  title: string | null
  text: string | null
}

/**
 * The newsletter box's variant and words (adr/0049 Ek 2026-11-17 e-bülten),
 * on a page or in the footer: `text` the consent sentence as before,
 * `description` every variant's, the promise line `split`'s and
 * `image_card`'s, the picture `image_card`'s (the server fills each
 * variant's own on reading).
 */
export interface NewsletterFields {
  variant: NewsletterVariant
  description: string | null
  note?: string | null
  show_note?: boolean
  image?: LayoutImage | null
  /**
   * The footer box's bands (`split`, `image_card`, `strip`): true draws
   * the band on the free rows footer's ground (adr/0070 §4 Ek); absent:
   * above the footer. A page's box never has it.
   */
  joined?: boolean
}

export interface NewsletterSection extends BodySectionBase, NewsletterFields {
  type: "newsletter"
  title: string | null
  text: string | null
}

/** A box of a title and a line: the help box, the newsletter box. */
export type WordedSection = HelpSection | NewsletterSection

export interface FaqItem {
  /** Plain text. */
  question: string
  /** Plain text; may hold the shop's details (`{telefon}`). */
  answer: string
}

/**
 * Questions and answers, shown on the page; never `FAQPage` structured data
 * (docs/13 §5). Its switches (bilesen-denetimi (b) 8) are filled on reading;
 * one absent reads as its default (`faqSettingsOf`).
 */
export interface FaqSection extends BodySectionBase, Partial<FaqSettings> {
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
  /** How the cards stand (bilesen-denetimi (b) 7); the server fills `grid` on reading. */
  variant: RelatedProductsVariant
  /** The rail's own card style over the theme's; null or absent: the theme's. */
  card_variant?: CardVariant | null
  /** `grid`: cards in a row on a wide screen. */
  columns?: ShelfColumns
  /** Cards in a row on a phone (bilesen-denetimi (b) 3); the server fills 2 on reading. */
  columns_mobile?: ShelfPhoneColumns
  /** `carousel`: the scroller kit's settings. */
  scroller?: ScrollerSettings
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
export type HeaderMarquee = SectionBase & MarqueeFields & { device?: SectionDevice }

export type HomeSection =
  | HeroSection
  | HeroSliderSection
  | BannerSection
  | StripGallerySection
  | StatsSection
  | StepsSection
  | SearchBoxSection
  | PhotoCollageSection
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
  | PriceBandsSection

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

/**
 * The header's announcement bar: its lines and how it shows more than one
 * (docs/tema/bilesen-denetimi (b) 6). The server fills each setting on
 * reading; one absent reads as its default (`announcementSettingsOf`).
 */
export type AnnouncementBar = SectionBase & {
  type: "announcement_bar"
  lines: string[]
} & Partial<AnnouncementSettings>

export interface FooterNewsletter extends SectionBase, NewsletterFields {
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
  /**
   * The ready-made look the design was last given (adr/0063 §4), and the
   * look applied with its digest (adr/0064 Ek 2026-11-17): labels the
   * server writes and reads; the editor carries them as they are.
   */
  preset?: { pack: string; code: string; version: number } | null
  design?: { id: string | null; digest: string } | null
}

/** The header: the announcement bar, the scrolling strip and the shop's bar, each at most once. */
export type HeaderSection = AnnouncementBar | HeaderMarquee | HeaderBarSection
/** The footer group (adr/0070 §4): the bar, and above it a box, a rich text, badges, a strip. */
export type FooterSection =
  FooterNewsletter | FooterBarSection | RichTextSection | TrustBadgesSection | MarqueeSection
/** The footer group's sections drawn as a page's, each at most once (adr/0070 §4). */
export type FooterBodySection = RichTextSection | TrustBadgesSection | MarqueeSection

/** Each group's sections; the product and category pages' main one beside their body (`BodySection`). */
export interface LayoutDocument {
  header: HeaderSection[]
  home: HomeSection[]
  footer: FooterSection[]
  product: (ProductMainSection | ProductSection)[]
  category: (CategoryMainSection | CategorySection)[]
  /** The content pages' own layouts, by page (adr/0073 §1); none: every page drawn as before. */
  pages: PageLayout[]
  settings: LayoutSettings
}

/**
 * The document's section groups (its settings are not one); a section of
 * a content page is in `pages`, under its page.
 */
export type LayoutGroup = Exclude<keyof LayoutDocument, "settings">
/** The groups held as one list of sections (all but the content pages'). */
export type ListGroup = Exclude<LayoutGroup, "pages">
/** The groups that make a page's body: sections are added, moved and copied in them. */
export type BodyGroup = "home" | "product" | "category"
/** A page's body: one of the page templates' or a content page's own (adr/0073). */
export type PageGroup = BodyGroup | "pages"
export type BodySection = HomeSection | ProductSection | CategorySection | ContentPageSection
export type BodySectionType = BodySection["type"]
export type AnySection = HeaderSection | BodySection | FooterSection | MainSection
/** What takes a look (adr/0049 Ek 2026-11-14 §6): a page's body section and its main one. */
export type LookedSection = BodySection | ProductMainSection | CategoryMainSection
