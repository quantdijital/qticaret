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
  top_links: StorefrontLink[]
  footer_groups: { title: string; links: StorefrontLink[] }[]
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  /** E.164 (`+905321234567`). */
  whatsapp_phone: string | null
  /** The header's menu as the shop names it; empty: the category tree. */
  menu: (StorefrontLink & { children: StorefrontLink[] })[]
  /** `#rrggbb`; null: the theme's own colour. */
  primary_color: string | null
  /** The home page's opening; null: the shop's name and first two categories. */
  hero: {
    eyebrow: string | null
    heading: string
    text: string | null
    links: StorefrontLink[]
  } | null
}

/** `GET /store/storefront`: the frame and the free shipping threshold (F4.5). */
export interface StorefrontAnswer {
  storefront: StorefrontFrame
  /** Lira, KDV in, after discounts (`item_total`); null: no free shipping. */
  free_shipping_threshold: number | null
}

/** The shop's legal identity, public by law (F13.9); what is missing is null. */
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
}
