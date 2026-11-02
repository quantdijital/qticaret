/**
 * The storefront's frame (F18 D3, docs/19 §4): `GET /store/storefront` and
 * `GET /store/legal-identity`. A copy of the backend's section type: the
 * backend's build does not compile workspace TypeScript (adr/0046 §8).
 */

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

/** The page colour's name; the storefront paints each with the backend's `THEME_BACKGROUNDS`. */
export type ThemeBackground = "warm" | "neutral" | "cool"

/**
 * How the storefront looks (F18 D11, adr/0053 §B): choices from fixed
 * lists, never CSS. The defaults are today's look.
 */
export interface StoreThemeSettings {
  theme: "base"
  colors: {
    /** `#rrggbb`; null: the theme's own ink. Falls back to `storefront.primary_color`. */
    primary: string | null
    /** `#rrggbb` for badges and highlights; null: the primary colour. Not contrast-checked. */
    accent: string | null
    background: ThemeBackground
  }
  typography: { heading: ThemeHeadingFont; body: ThemeBodyFont }
  radius: "sharp" | "soft" | "round"
  product_card: { ratio: "4:5" | "1:1" | "3:4"; show_brand: boolean; show_rating: boolean }
  header: { layout: "centered" | "left"; sticky: boolean }
  buttons: "pill" | "rounded" | "square"
}

/** `GET /store/storefront`: the frame and the free shipping threshold (F4.5). */
export interface StorefrontAnswer {
  storefront: StorefrontFrame
  /** The theme's choices (adr/0053 §B); absent from a backend before it: the defaults. */
  theme?: StoreThemeSettings
  /** Lira, KDV in, after discounts (`item_total`); null: no free shipping. */
  free_shipping_threshold: number | null
  /** What the storefront offers only while the shop has it on. */
  features?: { gift_cards: boolean }
}

/** The shop's legal identity and how it is reached (F13.9, adr/0048); what is missing is null. */
export interface LegalIdentity {
  company_title: string | null
  mersis: string | null
  tax_office: string | null
  tax_number: string | null
  address: string | null
  kep: string | null
  etbis: string | null
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
  author_name: string | null
  published_at: string | null
  revised_at: string | null
  reading_minutes: number
  /** A post's category and tags; a page has neither. */
  category?: StoreContentTerm | null
  tags?: StoreContentTerm[]
}
