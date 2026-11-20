import type { AnnouncementSettings, SocialNetwork, TrustIcon } from "@qticaret/types"
import type { CategoryCardView, ShopMarkView } from "./card-views"
import type { CartLineView, CheckoutBlockedView, FreeShippingView } from "./cart-views"
import type { HomeSectionView } from "./content-views"
import type { BottomNavView, ThemeView } from "./frame-views"
import type { FooterBarView, HeaderBarView } from "./main-views"
import type { MarqueeSectionView } from "./marquee-views"
import type { NewsletterLookView } from "./newsletter-views"

/**
 * What a theme is given to show (adr/0046 §7): ready-made view models.
 * The storefront fills them from the Store API; a theme formats nothing
 * but layout, so two themes show the same prices, paths and words.
 */

// The views by topic; every name is exported from here as before
export type * from "./product-views"
export type * from "./video-views"
export type * from "./listing-views"
export type * from "./content-views"
export type * from "./page-text-views"
export type * from "./newsletter-views"
export type * from "./cart-views"
export type * from "./quick-view-views"

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
  /**
   * A signed-in wholesaler's note beside a price without KDV ("Toptan
   * fiyat · KDV hariç", ADR-0068 §5–§7): `current` is then without KDV.
   * Absent for every other shopper, whose price includes it.
   */
  taxNote?: string | null
}

export interface LinkView {
  label: string
  /** A path on the shop, or an https address the shop linked to. */
  path: string
}

/**
 * A menu entry: its picture when the category has one (adr/0046 Ek
 * 2026-11-04) and its product count when counted; its children carry
 * both too, for the header's dropdown and the phone drawer's rows.
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
  /** The network a theme draws a glyph for; none: an address it does not know (its first letter). */
  network?: SocialNetwork | null
}

/** The cart as the header's drawer shows it (D6): its lines read-only, the subtotal. */
export interface MiniCartView {
  lines: CartLineView[]
  subtotal: string
  freeShipping: FreeShippingView | null
  /** A payment link's cart (adr/0051): its lines are fixed; the note, in words. */
  locked?: string | null
  /**
   * A wholesaler's drawer (ADR-0068 §5): the lines and the subtotal are
   * without KDV and this says so, in place of the drawer's usual note.
   * Absent for every other shopper.
   */
  taxNote?: string | null
  /**
   * Why the cart cannot go to the payment yet, as on the cart page
   * (`CartPageView.checkoutBlocked`): the drawer's "Ödemeye geç" is drawn
   * off with the reason beside it. Null or left out: the button as ever.
   */
  checkoutBlocked?: CheckoutBlockedView | null
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
   * How the bar shows more than one line (docs/tema/bilesen-denetimi (b) 6):
   * only the first, taking turns every `interval` (stopped under the pointer
   * when `hover_pause`, on focus, by its pause button and under reduced
   * motion), or side by side on a wide screen. Absent (an older storefront):
   * the first line alone.
   */
  announcementSettings?: AnnouncementSettings
  /**
   * The announcement bar's section id, set only in the theme editor's live
   * preview (adr/0065 Faz 2b): the bar then carries its section mark and
   * each line its field mark (`lines.<n>`). Absent on a live page, whose
   * bar stays as it is drawn today.
   */
  announcementMark?: string
  /**
   * Set only in the theme editor's live preview (adr/0065 Faz 2b): the
   * frame marks its fields too (the catalog header's search and highlighted
   * link; the header's strip and the footer's newsletter box with their
   * own section marks). Absent on a live page, whose frame is drawn as today.
   */
  editor?: true
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
  newsletter:
    | ({
        title: string
        text: string
        /** Its section id, only in the theme editor's live preview (`editor`): the box's section mark. */
        mark?: string
        /**
         * A band drawn on the free rows footer's ground as its top band
         * (adr/0070 §4 Ek), not above the footer; absent: above it.
         */
        joined?: boolean
      } & Partial<NewsletterLookView>)
    | null
  /**
   * The footer group's sections drawn above the footer on every page but
   * the checkout's, in the group's order, as a page's (adr/0070 §4): a
   * rich text, trust badges, a scrolling strip, and under the free rows
   * footer the newsletter box as a band. None or absent: nothing above it.
   */
  footerSections?: readonly HomeSectionView[]
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
