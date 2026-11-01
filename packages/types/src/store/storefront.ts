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
