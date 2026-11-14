import type { TrustIcon } from "@qticaret/types"
import type { CategoryCardView, ShopMarkView } from "./card-views"
import type { CartLineView, FreeShippingView } from "./cart-views"
import type { BottomNavView, ThemeView } from "./frame-views"
import type { FooterBarView, HeaderBarView } from "./main-views"
import type { MarqueeSectionView } from "./marquee-views"

/**
 * What a theme is given to show (adr/0046 §7): ready-made view models.
 * The storefront fills them from the Store API; a theme formats nothing
 * but layout, so two themes show the same prices, paths and words.
 */

// The views by topic; every name is exported from here as before
export type * from "./product-views"
export type * from "./listing-views"
export type * from "./content-views"
export type * from "./cart-views"

/** A picture with its versions (adr/0016): one `<source>` per format. */
export interface ImageView {
  src: string
  alt: string
  width: number | null
  height: number | null
  /** `srcset` strings by format, widest last ("…-400.avif 400w, …"). */
  sources: { avif: string | null; webp: string | null }
}

export interface PriceView {
  /** Formatted for the shopper: "1.250,00 TL". */
  current: string
  /** The struck-through price, only when the 30-day rule allows one (F4.3). */
  before: string | null
  /** True when variants differ: the theme says "…'den başlayan". */
  from: boolean
  /** Whole percent off the struck-through price ("%25"); null without one. */
  discount: number | null
  /** What the struck-through price saves, formatted ("150,00 TL"); null without one. */
  saving?: string | null
  /**
   * An automatic promotion the cart applies once it holds enough, in words
   * ("2.000,00 TL ve üzeri sepette %10 indirim"; adr/0046 Ek 2026-11-05):
   * beside the price, never instead of it. None: no such offer.
   */
  cartOffer?: string | null
}

export interface LinkView {
  label: string
  /** A path on the shop, or an https address the shop linked to. */
  path: string
}

/**
 * A mega menu entry: its picture when the category has one (adr/0046 Ek
 * 2026-11-04); its children too carry one, for the phone drawer's rows.
 */
export interface NavCategoryView extends CategoryCardView {
  children: CategoryCardView[]
}

/** A promise in the trust strip (D3): an icon name, a title and a line. */
export interface TrustBadgeView {
  icon: TrustIcon
  title: string
  text: string | null
}

export interface FooterGroupView {
  title: string
  links: LinkView[]
}

export interface ContactView {
  email: string | null
  /** For reading: "0532 123 45 67". */
  phone: string | null
  /** `tel:+905321234567`. */
  phoneHref: string | null
  /** `https://wa.me/905321234567`, when the shop gave a WhatsApp number. */
  whatsappHref: string | null
  address: string | null
  /** When the shop answers, days with the same hours together; none: not said. */
  hours: OpeningHoursView[]
  /** The shop's place on a map (https), when it gave one. */
  mapHref: string | null
}

/** A line of the shop's hours, in words: "Pazartesi – Cuma", "08:00 – 19:00" (or "Kapalı"). */
export interface OpeningHoursView {
  days: string
  hours: string
}

export interface SocialLinkView {
  /** The network's name ("Instagram"), or the address's host. */
  label: string
  href: string
}

/** The cart as the header's drawer shows it (D6): its lines read-only, the subtotal. */
export interface MiniCartView {
  lines: CartLineView[]
  subtotal: string
  freeShipping: FreeShippingView | null
  /** A payment link's cart (adr/0051): its lines are fixed; the note, in words. */
  locked?: string | null
}

/** Everything the frame around every page shows (D3, docs/19 §4). */
export interface ShopView {
  name: string
  logo: ImageView | null
  categories: NavCategoryView[]
  cartQuantity: number
  /** The open cart's lines for the drawer; null without one. */
  cart: MiniCartView | null
  /** The announcement bar's lines; none: no bar. */
  announcements: string[]
  /**
   * The header group's scrolling strip, drawn above the shop's header on
   * every page but the checkout's (adr/0049 Ek 2026-11-14 §4.1); none or
   * absent: no strip.
   */
  marquee?: MarqueeSectionView | null
  /**
   * The shop's header bar and footer, the design's main sections (adr/0049
   * Ek 2026-11-14 §5): their variants, and whether the header stays at the
   * top (it overrides `theme.header.sticky`). Absent: today's header and
   * footer, the header sticky as `theme.header` says.
   */
  headerBar?: HeaderBarView
  footerBar?: FooterBarView
  /** The footer's newsletter box in the shop's words; null: the shop took it out (adr/0049). */
  newsletter: { title: string; text: string } | null
  /** The header's small links (about, contact…). */
  topLinks: LinkView[]
  /** The shop's own columns, or the storefront's (categories, help). */
  footerGroups: FooterGroupView[]
  trustBadges: TrustBadgeView[]
  contact: ContactView
  social: SocialLinkView[]
  /** The registered title for the footer's small print; null shows the shop's name. */
  companyTitle: string | null
  /**
   * The cookie question (D9): open by itself while the visitor has not
   * answered under the policy now, else kept for the footer's "cookie
   * preferences" link to open again. Null when the answer could not be read.
   */
  cookieBanner: CookieBannerView | null
  /** The signed-in customer's first name; null for a guest. */
  customerName: string | null
  /** The shop's published legal texts' pages (D10). */
  legalLinks: LinkView[]
  /** The KVKK notice's page, for the forms that collect an address; null until published. */
  privacyPath: string | null
  /** What the law asks a web shop to show (6563, ETBİS): title, MERSİS, tax, KEP, ETBİS; in words. */
  identityLines: string[]
  /** The shop's theme choices that change markup (adr/0053 §B). */
  theme: ThemeView
  /** The phone's bottom bar; null where it stays away (checkout, a preview). */
  bottomNav: BottomNavView | null
  /**
   * The page is a step of paying (`/odeme`, its card form, the payment's
   * result): a theme may draw a focused frame without the shop's ways out
   * (search, menus, the announcement); none or false: the shop's frame.
   */
  checkout?: boolean
  /** The ETBİS registration's QR code for the footer (adr/0046 Ek 2026-11-04); none: no slot. */
  etbisQr?: ImageView | null
  /** The ways to pay the shop offers now, in words (derived, never typed in). */
  paymentMarks?: ShopMarkView[]
  /** The carriers whose contract the shop connected, in words. */
  carrierMarks?: ShopMarkView[]
}

export interface CookieBannerView {
  policyVersion: number | null
  /** The cookie policy's page, when the shop published one. */
  policyPath: string | null
  /** No answer yet under the policy now: the banner shows by itself. */
  due: boolean
  /** The answer in force, for the boxes; both false while one is due. */
  analytics: boolean
  marketing: boolean
}

/** `/cerez-tercihleri`: the banner's form on a page of its own, for a browser without script. */
export interface CookiePreferencesPageView {
  title: string
  banner: CookieBannerView
  /** Said once the choice is saved. */
  notice: string | null
}
