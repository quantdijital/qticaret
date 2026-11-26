/**
 * The storefront's frame (F18 D3, docs/19 §4): `GET /store/storefront` and
 * `GET /store/legal-identity`. A copy of the backend's section type: the
 * backend's build does not compile workspace TypeScript (adr/0046 §8).
 */
import type { MediaDerivatives, StoreImage } from "./catalog.js"
import type { AccentFont } from "./hand-note.js"
import type { ListingPageSettings } from "./listing-page.js"
import type { ListingTextSettings } from "./listing-text.js"
import type { SearchFormSettings } from "./search-form.js"
import type { CardVariant } from "./section-variants.js"
import type { StyleKit } from "./style-kit.js"
import type { TurnstilePublic } from "./turnstile.js"

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
  /**
   * The content pages with a role, by id (adr/0073 Açık kararlar 3): the
   * contact page carries the contact form (adr/0047), the payment and
   * shipping pages the live facts (adr/0046 Ek 2026-11-05); null: none.
   * Absent from a backend before the ids: the paths below name them.
   */
  contact_page_id?: string | null
  payment_page_id?: string | null
  shipping_page_id?: string | null
  /** The contact page's address while it is live; null: none. */
  contact_form_path: string | null
  /**
   * The payment and shipping pages' addresses while they are live (the
   * product page links to the shipping page); null: none. Absent from a
   * backend before them: `/odeme-secenekleri` and `/kargo-ve-teslimat`.
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
export type ThemeHeadingFont =
  "fraunces" | "inter" | "playfair" | "dm-serif" | "manrope" | "plus-jakarta" | "montserrat"

/** The body faces a shop may choose. */
export type ThemeBodyFont =
  "inter" | "manrope" | "source-sans" | "nunito" | "plus-jakarta" | "montserrat"

/**
 * The page colour's name; the storefront paints each with the backend's
 * `THEME_BACKGROUNDS`. `steel` is Grafit's counter and the default (adr/0062 §3).
 */
export type ThemeBackground = "steel" | "warm" | "neutral" | "cool"

/**
 * How the storefront looks (F18 D11, adr/0053 §B): choices from fixed
 * lists, never CSS. The defaults are today's Grafit look (adr/0062 §2);
 * the style kit's fields (`STYLE_KIT`, adr/0067) at their first step.
 */
export interface StoreThemeSettings extends StyleKit {
  theme: "atolye"
  colors: {
    /** `#rrggbb`; null: the theme's own ink. Falls back to `storefront.primary_color`. */
    primary: string | null
    /** `#rrggbb` for badges and highlights; null: the primary colour. Not contrast-checked. */
    accent: string | null
    background: ThemeBackground
  }
  typography: {
    heading: ThemeHeadingFont
    body: ThemeBodyFont
    /**
     * The face a section's hand note is drawn in (`hand-note.ts`); absent
     * (a backend before it) or `none`: the note in the body face, italic.
     */
    accent?: AccentFont
  }
  radius: RadiusStep
  product_card: {
    /** The photo's shape (`CARD_RATIOS`); `4:3` the short, wide one (sahip 2026-11-26). */
    ratio: CardRatio
    show_brand: boolean
    show_rating: boolean
    /** How cards are drawn; a product rail may draw its own (`card_variant`). */
    variant: CardVariant
    /**
     * Every card's second photo on hover, swiped on a large card on a touch
     * screen (sahip 2026-11-18; the framed card's E5 before).
     */
    hover_image: boolean
    /**
     * While `hover_image` is on: every photo of the product in turn while a
     * mouse rests on the card, not only the second (sahip 2026-11-26). Off:
     * today's second photo.
     */
    hover_cycle: boolean
    /** A standard card's rows, today's `regular` or `compact` (`CARD_DENSITIES`). */
    density: CardDensity
    /** A framed card's "free shipping" line, from its price and the shop's threshold (E5). */
    delivery_note: boolean
    /** A framed card's add button across its foot instead of the round "+" (E5). */
    full_button: boolean
    /** The discount pill on the photo ("%30"), on every variant (adr/0049 Ek 2026-11-15). */
    sale_badge: boolean
    /** The "Az kaldı" pill on a low stock bucket; the compact card draws none. */
    low_stock_badge: boolean
    /** The "Tükendi" pill on a sold-out card's photo. */
    sold_out_badge: boolean
    /** A sold-out card's price row (`CARD_SOLD_OUT_ROWS`). */
    sold_out_row: CardSoldOutRow
    /** Where the stars stand on a product without reviews, while they are shown (`CARD_NO_REVIEWS`). */
    no_reviews: CardNoReviews
    /** The framed card's add button across its foot (`CARD_BUTTON_STYLES`). */
    button_style: CardButtonStyle
    /** A "Hızlı bak" button on every card, opening the product in a dialog (adr/0049 Ek 2026-11-15). */
    quick_view: boolean
    /** How the button shows (`CARD_QUICK_VIEW_TRIGGERS`); a compact card always draws the icon. */
    quick_view_trigger: CardQuickViewTrigger
    /** The dialog's stars, short description and quantity field, each the shop's. */
    quick_view_rating: boolean
    quick_view_summary: boolean
    quick_view_quantity: boolean
    /**
     * A standard card's words (adr/0077 Ek "tur kartı"): under the photo
     * (today's) or over a dark fade on it (`CARD_TEXT_POSITIONS`).
     */
    text_position: CardTextPosition
    /** The stars' average as a pill on the photo instead of the stars' row, while they are shown. */
    rating_badge: boolean
    /** A round arrow at a standard card's foot, for the eye only (the card keeps its one link). */
    arrow: boolean
    /** A dated product's length ("5 gün • 4 gece") from its tour length attribute, when it has one. */
    duration_row: boolean
    /** "kişi başı" after a dated product's price. */
    per_person: boolean
    /**
     * A standard card's stars, length and nearest departure (`CARD_META_PLACES`,
     * sahip 2026-11-26): in its rows (today's `below`) or as glass pills on the photo.
     */
    meta_place: CardMetaPlace
    /**
     * A standard card's frame (`CARD_STYLES`, sahip 2026-11-26): today's `plain`,
     * or `glass`, the name and price on a frosted panel floating on the photo.
     */
    style: CardStyle
  }
  header: { layout: "centered" | "left"; sticky: boolean }
  buttons: "pill" | "rounded" | "square"
  /** The gap between sections, theme-wide; `normal` is the theme's own (`SECTION_SPACINGS`). */
  section_spacing: SectionSpacing
  /** How the theme's boxes stand on the page (`SURFACE_STYLES`); `filled` is today's tone. */
  surface_style: SurfaceStyle
  /**
   * How a category, brand or collection page's own text looks at the foot
   * of the page (adr/0075, `listing-text.ts`). Absent from a backend before
   * it: `LISTING_TEXT_DEFAULTS` (`listingTextOf`).
   */
  listing_text?: ListingTextSettings
  /**
   * How a listing page lays out its products and its trail (`listing-page.ts`).
   * Absent from a backend before it: `LISTING_PAGE_DEFAULTS` (`listingPageOf`).
   */
  listing_page?: ListingPageSettings
  /**
   * The search box's fields (adr/0077 §1, `search-form.ts`). Absent from
   * a backend before it: `SEARCH_FORM_DEFAULTS` (`searchFormOf`).
   */
  search_form?: SearchFormSettings
}

/**
 * How the theme draws its boxes (product page summary, rating summary,
 * info blocks, category filters and tiles, the cart drawer's boxes;
 * Tezgâh audit Z-04): `filled` a tone darker than the page (the default,
 * today's look), `lined` the page's ground inside a 1 px rule. One
 * theme-wide choice, as Shopify themes' card style; the backend mirrors
 * the list.
 */
export const SURFACE_STYLES = ["filled", "lined"] as const
export type SurfaceStyle = (typeof SURFACE_STYLES)[number]

/**
 * The corners, sharpest first (adr/0062 §8): the theme scales its three
 * corners (a tile's, a photo's, an inner part's) by each step's factor;
 * `soft` is the theme's own and the default. `crisp` and `gentle`, between
 * `sharp` and `soft`, came later (adr/0067 Ek 2026-11-16); the others keep
 * their meaning. The backend mirrors the list.
 */
export const RADIUS_STEPS = ["sharp", "crisp", "gentle", "soft", "round"] as const
export type RadiusStep = (typeof RADIUS_STEPS)[number]

/**
 * The gap between sections, theme-wide (Tezgâh audit K-11, as Shopify
 * themes' section spacing), closest first: `tight` the closest (adr/0067
 * Ek 2026-11-16), `compact` a dense catalog's, `normal` the theme's own
 * (the default, today's gaps), `roomy` a showcase's. The theme maps each
 * onto its own scale; the backend mirrors the list.
 */
export const SECTION_SPACINGS = ["tight", "compact", "normal", "roomy"] as const
export type SectionSpacing = (typeof SECTION_SPACINGS)[number]

/**
 * A sold-out card's price row (adr/0049 Ek 2026-11-15, the owner's
 * decision b): `price` the price stays and nothing adds it to the cart
 * (today's card, the default), `text` "Tükendi" in its place, `notify`
 * "Gelince haber ver" to the product page's stock alert form.
 */
export const CARD_SOLD_OUT_ROWS = ["price", "text", "notify"] as const
export type CardSoldOutRow = (typeof CARD_SOLD_OUT_ROWS)[number]

/**
 * A card's stars on a product without reviews, while the shop shows the
 * stars (decision c): `hide` nothing (today's, the default), `empty_stars`
 * empty stars and "Henüz yorum yok", `write_first` "İlk yorumu sen yaz" to
 * the product page's reviews. Replaces the framed card's `empty_stars` switch.
 */
export const CARD_NO_REVIEWS = ["hide", "empty_stars", "write_first"] as const
export type CardNoReviews = (typeof CARD_NO_REVIEWS)[number]

/**
 * The framed card's add button across its foot (decision d), the
 * standard's names (`button_style`): `solid` filled in the action's colour,
 * `outline` the quiet bordered button filled on hover (today's, the
 * default), `text` an underlined word.
 */
export const CARD_BUTTON_STYLES = ["solid", "outline", "text"] as const
export type CardButtonStyle = (typeof CARD_BUTTON_STYLES)[number]

/**
 * How a card's quick view button shows (adr/0049 Ek 2026-11-15): `hover`
 * a "Hızlı bak" button while the card is pointed at or focused (a touch
 * screen, with nothing to point, shows the icon), `icon` a small icon
 * button always.
 */
export const CARD_QUICK_VIEW_TRIGGERS = ["hover", "icon"] as const
export type CardQuickViewTrigger = (typeof CARD_QUICK_VIEW_TRIGGERS)[number]

/**
 * Where a standard card's words stand (adr/0077 Ek "tur kartı"): `below`
 * the photo (today's card, the default), `over` it, on a dark fade at its
 * foot, the price at the right. The framed and compact cards keep theirs.
 * `over_split` (adr/0077 Ek 2026-11-25, a destination card): over the photo,
 * the name and the product's subtitle at the left, a short price in the
 * accent colour at the right, no rows under them.
 */
export const CARD_TEXT_POSITIONS = ["below", "over", "over_split"] as const
export type CardTextPosition = (typeof CARD_TEXT_POSITIONS)[number]

/**
 * A card photo's shape, width to height: today's square first among the
 * tall ones; `4:3` (sahip 2026-11-26) a short, wide photo for a compact card.
 */
export const CARD_RATIOS = ["4:5", "1:1", "3:4", "4:3"] as const
export type CardRatio = (typeof CARD_RATIOS)[number]

/**
 * A standard card's rows (sahip 2026-11-26, a tour card): `regular`
 * today's; `compact` the price right under the name, the stars with their
 * count and a dated product's length on one line (on the photo's pill when
 * the words stand over it), less room between them.
 */
export const CARD_DENSITIES = ["regular", "compact"] as const
export type CardDensity = (typeof CARD_DENSITIES)[number]

/**
 * Where a standard card's stars, length and nearest departure stand
 * (sahip 2026-11-26): `below` today's rows; `over` frosted pills on the
 * photo's corners, leaving the name and price under it.
 */
export const CARD_META_PLACES = ["below", "over"] as const
export type CardMetaPlace = (typeof CARD_META_PLACES)[number]

/**
 * A standard card's frame (sahip 2026-11-26): `plain` today's; `glass` the
 * photo filling the card, the name and price on a frosted panel floating
 * at its foot that lifts on hover.
 */
export const CARD_STYLES = ["plain", "glass"] as const
export type CardStyle = (typeof CARD_STYLES)[number]

/** A shop's shipping class (adr/0087): its key on products and its surcharge in lira (its name stays in the panel). */
export interface StoreShippingClass {
  key: string
  surcharge: number
}

/** `GET /store/storefront`: the frame and the free shipping threshold (F4.5). */
export interface StorefrontAnswer {
  storefront: StorefrontFrame
  /** The theme's choices (adr/0053 §B); absent from a backend before it: the defaults. */
  theme?: StoreThemeSettings
  /** Lira, KDV in, after discounts (`item_total`); null: no free shipping. */
  free_shipping_threshold: number | null
  /**
   * The shop's own shipping classes (adr/0087 §3), a surcharge in lira each,
   * added once per order; absent from a backend before it: none.
   */
  shipping_classes?: StoreShippingClass[]
  /**
   * When an order leaves and arrives, as the shop set them (adr/0046 Ek
   * 2026-11-06); absent from a backend before it: the product page says
   * the shop's own delivery lines instead.
   */
  delivery?: StoreDelivery
  /**
   * What the storefront offers only while the shop has it on: gift card
   * codes (F4.8) and product add-ons (adr/0052); their routes answer 404 while off.
   * `booking`: dated products (`catalog.booking`, adr/0076), the sections that
   * need it drawn only while on (adr/0077 §8); absent from a backend before it.
   * `collections`: product collections (`catalog.collections`), on by default;
   * `false` only when the shop turned them off (absent: on).
   * `popups`: storefront pop-ups (`marketing.popups`, adr/0080), on by
   * default; `GET /store/popups` is read only while on (absent: off).
   */
  features?: {
    gift_cards: boolean
    product_addons: boolean
    booking?: boolean
    collections?: boolean
    /**
     * Search in the shopper's own words (`ai.storefront_search`, adr/0077 §7):
     * `/arama` reads a sentence into filters, the search box says not to
     * write personal details; absent from a backend before it: off.
     */
    natural_search?: boolean
    popups?: boolean
  }
  /**
   * The footer's ways to pay and carriers (adr/0046 Ek 2026-11-04), derived
   * from what the shop set up; absent from a backend before it: none.
   */
  marks?: { payments: StorePaymentMark[]; carriers: StoreCarrierMark[] }
  /** Turnstile's public site key for the risky forms (adr/0044 Ek 2026-11-24); absent from a backend before it. */
  turnstile?: TurnstilePublic
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
  /**
   * A licence its trade asks it to show (adr/0076 §12), as the shop names
   * it: "TÜRSAB belge no", its number, whose it is when given; absent or
   * null: none.
   */
  document?: { name: string; number: string; holder: string | null } | null
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

/**
 * `GET /store/content/terms?kind=`: a category or tag with live posts, in
 * the shop's order. Its text is its archive's own read
 * (`StoreContentTermDescription`, adr/0075 Ek 2026-11-24).
 */
export interface StoreContentTermSummary extends StoreContentTerm {
  kind: "category" | "tag"
  post_count: number
}

/**
 * `GET /store/content/terms/:id/description` (adr/0075 Ek 2026-11-24): a
 * listed blog category's or tag's text for the foot of its archive: as
 * the shop formatted it, rendered on the server (null: none, or stale),
 * and its plain text, shown without the HTML.
 */
export interface StoreContentTermDescription {
  term_id: string
  description: string | null
  description_html: string | null
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
