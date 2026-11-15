/**
 * The storefront's frame (F18 D3, docs/19 §4): `GET /store/storefront` and
 * `GET /store/legal-identity`. A copy of the backend's section type: the
 * backend's build does not compile workspace TypeScript (adr/0046 §8).
 */
import type { MediaDerivatives, StoreImage } from "./catalog.js"
import type { CardVariant } from "./section-variants.js"

export type TrustIcon =
  "truck" | "clock" | "shield" | "card" | "refresh" | "award" | "gift" | "phone"

export interface StorefrontLink {
  label: string
  /** A path on the shop (`/hakkimizda`) or an https address. */
  href: string
}

export interface StorefrontFrame {
  announcements: string[]
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  /** `#rrggbb`; null: the theme's own colour. */
  primary_color: string | null
  /** The home page's opening; null: the shop's name and first two categories. */
  hero: {
    eyebrow: string | null
    heading: string
    text: string | null
    links: StorefrontLink[]
  } | null
  /** The shop page that carries the contact form (adr/0047); null: no form. */
  contact_form_path: string | null
  /**
   * The shop pages the live payment and shipping facts stand beside
   * (adr/0046 Ek 2026-11-05); null: none. Absent from a backend before
   * them: `/odeme-secenekleri` and `/kargo-ve-teslimat`.
   */
  payment_info_path?: string | null
  shipping_info_path?: string | null
  /** Colour names and their `#rrggbb`: option and filter values that match show as swatches. */
  color_swatches: { label: string; hex: string }[]
}

export type MenuLinkKind =
  | "category"
  | "product"
  | "collection"
  | "brand"
  | "page"
  | "post"
  | "landing"
  | "legal"
  | "system"
  | "url"

/** A menu link as `GET /store/storefront-menus` gives it (adr/0049); a broken one is not there. */
export interface StoreMenuLink {
  /** The shop's wording, else the record's or legal text's name; null: the storefront's own name. */
  label: string | null
  kind: MenuLinkKind
  /** A record's id, a legal kind or a storefront page's key. */
  target: string | null
  /** The record's live path or the address; null: a storefront page or a legal text. */
  path: string | null
  children: StoreMenuLink[]
}

/** A storefront menu (adr/0049): the header's, the top links, or a footer column. */
export interface StoreMenu {
  title: string
  location: "main" | "top" | "footer"
  rank: number
  items: StoreMenuLink[]
}

/** The heading faces a shop may choose (adr/0053 §B): names, each self-hosted by the storefront. */
export type ThemeHeadingFont = "fraunces" | "inter" | "playfair" | "dm-serif" | "manrope"

/** The body faces a shop may choose. */
export type ThemeBodyFont = "inter" | "manrope" | "source-sans" | "nunito"

/**
 * The page colour's name; the storefront paints each with the backend's
 * `THEME_BACKGROUNDS`. `steel` is Grafit's counter and the default (adr/0062 §3).
 */
export type ThemeBackground = "steel" | "warm" | "neutral" | "cool"

/**
 * How the storefront looks (F18 D11, adr/0053 §B): choices from fixed
 * lists, never CSS. The defaults are today's Grafit look (adr/0062 §2).
 */
export interface StoreThemeSettings {
  theme: "atolye"
  colors: {
    /** `#rrggbb`; null: the theme's own ink. Falls back to `storefront.primary_color`. */
    primary: string | null
    /** `#rrggbb` for badges and highlights; null: the primary colour. Not contrast-checked. */
    accent: string | null
    background: ThemeBackground
  }
  typography: { heading: ThemeHeadingFont; body: ThemeBodyFont }
  radius: "sharp" | "soft" | "round"
  product_card: {
    ratio: "4:5" | "1:1" | "3:4"
    show_brand: boolean
    show_rating: boolean
    /** How cards are drawn; a product rail may draw its own (`card_variant`). */
    variant: CardVariant
    /** A framed card's second photo on hover, swiped on a touch screen (E5). */
    hover_image: boolean
    /** A framed card's "free shipping" line, from its price and the shop's threshold (E5). */
    delivery_note: boolean
    /** A framed card's add button across its foot instead of the round "+" (E5). */
    full_button: boolean
    /** Empty stars on a framed card without reviews, while the stars are shown (E5). */
    empty_stars: boolean
  }
  header: { layout: "centered" | "left"; sticky: boolean }
  buttons: "pill" | "rounded" | "square"
  /** The gap between sections, theme-wide; `normal` is the theme's own (`SECTION_SPACINGS`). */
  section_spacing: SectionSpacing
}

/**
 * The gap between sections, theme-wide (Tezgâh audit K-11, as Shopify
 * themes' section spacing): `compact` a dense catalog's, `normal` the
 * theme's own (the default, today's gaps), `roomy` a showcase's. The
 * theme maps each onto its own scale; the backend mirrors the list.
 */
export const SECTION_SPACINGS = ["compact", "normal", "roomy"] as const
export type SectionSpacing = (typeof SECTION_SPACINGS)[number]

/** `GET /store/storefront`: the frame and the free shipping threshold (F4.5). */
export interface StorefrontAnswer {
  storefront: StorefrontFrame
  /** The theme's choices (adr/0053 §B); absent from a backend before it: the defaults. */
  theme?: StoreThemeSettings
  /** Lira, KDV in, after discounts (`item_total`); null: no free shipping. */
  free_shipping_threshold: number | null
  /**
   * When an order leaves and arrives, as the shop set them (adr/0046 Ek
   * 2026-11-06); absent from a backend before it: the product page says
   * the shop's own delivery lines instead.
   */
  delivery?: StoreDelivery
  /**
   * What the storefront offers only while the shop has it on: gift card
   * codes (F4.8) and product add-ons (adr/0052); their routes answer 404 while off.
   */
  features?: { gift_cards: boolean; product_addons: boolean }
  /**
   * The footer's ways to pay and carriers (adr/0046 Ek 2026-11-04), derived
   * from what the shop set up; absent from a backend before it: none.
   */
  marks?: { payments: StorePaymentMark[]; carriers: StoreCarrierMark[] }
}

/** Working days, the shorter first. */
export interface StoreDaySpan {
  min: number
  max: number
}

/** The shop's delivery promise, as set under Settings > Shipping > "Teslim süresi". */
export interface StoreDelivery {
  /** Working days to get an order out of the door; 0–0: the same day. */
  handling_days: StoreDaySpan
  /** The carrier's working days to the door. */
  transit_days: StoreDaySpan
  /** An order placed before this hour (1–23, Turkey) leaves the same day; null: not promised. */
  same_day_cutoff_hour: number | null
}

/** A way to pay the shop offers: card networks with a card provider, the provider, transfer, at the door. */
export type StorePaymentMark =
  "visa" | "mastercard" | "troy" | "paytr" | "iyzico" | "bank_transfer" | "cash_on_delivery"

/** A carrier whose contract the shop connected. */
export type StoreCarrierMark = "aras" | "yurtici"

/** The shop's legal identity and how it is reached (F13.9, adr/0048); what is missing is null. */
export interface LegalIdentity {
  company_title: string | null
  mersis: string | null
  tax_office: string | null
  tax_number: string | null
  address: string | null
  kep: string | null
  etbis: string | null
  /** The ETBİS registration's QR code (adr/0046 Ek 2026-11-04); absent or null: none. */
  etbis_qr?: StoreImage | null
  /** The shop's social profiles. */
  same_as: string[]
  email: string | null
  /** E.164. */
  phone: string | null
  /** The number the WhatsApp buttons open, E.164 (adr/0048). */
  whatsapp: string | null
  /** When the shop answers: ISO weekday (1 Monday) and `HH:MM`; none: not said. */
  opening_hours: { day: number; opens: string; closes: string }[]
  /** The shop's place on a map, https. */
  map_url: string | null
}

/** A blog category or tag a post is filed under, at its archive's path (adr/0019 ek 2026-11-03). */
export interface StoreContentTerm {
  id: string
  name: string
  handle: string
  /** `/blog/kategori/{handle}` or `/blog/etiket/{handle}`. */
  path: string
}

/** `GET /store/content/terms?kind=`: a category or tag with live posts, in the shop's order. */
export interface StoreContentTermSummary extends StoreContentTerm {
  kind: "category" | "tag"
  description: string | null
  post_count: number
}

/** A blog author's link on a network or the web: the person's own profile (`sameAs`). */
export interface StoreContentAuthorLink {
  kind: "website" | "linkedin" | "instagram" | "x"
  url: string
}

/** A post's author, at the author's page (`/blog/yazar/{handle}`, adr/0060). */
export interface StoreContentAuthor {
  id: string
  name: string
  handle: string
  /** `/blog/yazar/{handle}`. */
  path: string
  job_title: string | null
}

/** The author whole: on a post (`GET /store/content/:id`) and the author's page. */
export interface StoreContentAuthorDetail extends StoreContentAuthor {
  /** Plain text; a blank line between paragraphs. */
  bio: string | null
  image_url: string | null
  image_width?: number | null
  image_height?: number | null
  image_derivatives?: MediaDerivatives | null
  links: StoreContentAuthorLink[]
}

/** `GET /store/content/authors/:id`: the author's page, with how many live posts. */
export interface StoreContentAuthorPage extends StoreContentAuthorDetail {
  post_count: number
}

/** `GET /store/content?kind=post`: a live post as a list shows it (F3.16). */
export interface StoreContentSummary {
  id: string
  kind: "page" | "post"
  title: string
  handle: string
  path: string
  excerpt: string
  image_url: string | null
  image_alt: string | null
  /** The cover's size and versions from its media record; null when added by its address alone. */
  image_width?: number | null
  image_height?: number | null
  image_derivatives?: MediaDerivatives | null
  /** The linked author's name, else the free text written before authors (adr/0060). */
  author_name: string | null
  /** The post's author at the author's page; null: none chosen (only `author_name`, if any). */
  author?: StoreContentAuthor | null
  published_at: string | null
  revised_at: string | null
  reading_minutes: number
  /** A post's category and tags; a page has neither. */
  category?: StoreContentTerm | null
  tags?: StoreContentTerm[]
}
