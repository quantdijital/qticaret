import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

/** A platform settings section as stored, defaults filled in (adr/0012). */
export interface SectionResponse<T> {
  section: string
  values: T
  version: number
}

/** The shop's legal identity (F13.9): public, shown in the footer and the legal texts. */
export interface LegalSettings {
  company_title: string | null
  mersis: string | null
  tax_office: string | null
  tax_number: string | null
  address: string | null
  kep: string | null
  etbis: string | null
  same_as: string[]
}

export interface StoreSettings {
  contact_email: string | null
  /** E.164; the server accepts Turkish forms and normalises them. */
  contact_phone: string | null
  timezone: string
  weight_unit: "g" | "kg"
  dimension_unit: "cm" | "mm"
}

/** Staff security (F12.6, adr/0040): whether every staff member must pass 2FA; the owner's switch. */
export interface SecuritySettings {
  staff_mfa_required: boolean
  /** The suspicion score that holds an order for review (adr/0044). */
  fraud_review_score: number
  /** A first order at or above this (kuruş) adds to its score. */
  fraud_high_amount: number
}

/** Stock rules (F3.8): the shop's default low-stock threshold. */
export interface InventorySettings {
  low_stock_threshold: number
}

/** Card payments (F5 V6, V10); `max_installment` 0 is the provider's most. */
export interface PaymentSettings {
  installments_enabled: boolean
  max_installment: number
  /** The card provider the storefront offers first; null: the first connected. */
  card_provider: "paytr" | "iyzico" | null
}

/** The shop's bank account for transfers (F6, adr/0029); the IBAN without spaces. */
export interface BankTransferSettings {
  enabled: boolean
  account_holder: string
  bank_name: string
  iban: string
  deadline_hours: number
}

/** Cash on delivery (F6, adr/0029): the fee in kuruş or basis points, the limit in kuruş. */
export interface CashOnDeliverySettings {
  fee_type: "none" | "fixed" | "percent"
  fee_value: number
  max_amount: number
  shipping_option_ids: string[]
}

/** Shipping rules (F7.8): working days to leave and to arrive, the price table by desi (kuruş). */
export interface ShippingSettings {
  handling_days_min: number
  handling_days_max: number
  transit_days_min: number
  transit_days_max: number
  rate_table: { max_desi: number; price: number }[]
  over_desi_price: number
  /** The page labels print on: a label printer's roll, or A4 with four to a sheet. */
  label_format: LabelFormat
  /** The roll's size when `label_format` is `custom`. */
  label_custom: { width_mm: number; height_mm: number }
}

/** Return rules (F13.4, adr/0041): the right of withdrawal's days and who pays the return. */
export interface ReturnsSettings {
  /** The law's 14 days or longer; the return policy's {iade_süresi} reads it. */
  withdrawal_days: number
  return_shipping: "shop" | "customer"
}

export const MIN_WITHDRAWAL_DAYS = 14

/** Who restricted products are sold to (F13.3): the lowest age a buyer declares. */
export interface ComplianceSettings {
  min_age: number
}

export const LABEL_FORMATS = ["100x150", "100x100", "80x80", "a4", "custom"] as const
export type LabelFormat = (typeof LABEL_FORMATS)[number]

/** Promotion rules (F4.4, F4.5): codes per cart, free shipping from a basket total. */
export interface PromotionSettings {
  combine_codes: boolean
  /** Lira, KDV in, after discounts; null: no free shipping by basket total. */
  free_shipping_threshold: number | null
}

type UrlStyle = "prefixed" | "flat"

export interface SeoSettings {
  canonical_host: string | null
  url_style: { product: UrlStyle; category: UrlStyle; brand: UrlStyle }
  title_templates: {
    product: string
    category: string
    brand: string
    page: string
    post: string
    landing: string
  }
  description_templates: { product: string }
  robots_txt: string
  ai_crawler_preset: "ai_search_visible" | "block_training" | "none"
  /** A page without its own image shares this one (F12.10); from the media library. */
  default_og_image: string | null
  /** The storefront home page's title and description (F18); null: the shop's name, none. */
  home: { title: string | null; description: string | null }
}

const sectionUrl = (section: string) => `/admin/platform-settings/${section}`

/** Who on the staff hears of what by e-mail (F9.7); the bell shows alerts anyway. */
export interface NotificationSettings {
  staff_emails: string[]
  alert_new_order: boolean
  alert_bank_transfer: boolean
  alert_low_stock: boolean
  alert_seo_digest: boolean
  /** Texts the shop sends a day at most (F9.8). */
  sms_daily_limit: number
  /** E-mails the shop sends a day at most (F10 M9): a guard on bounces from made-up addresses. */
  email_daily_limit: number
}

/** Settings > Marketing (F10). */
export interface MarketingSettings {
  /** A shopper who left a cart gets one reminder, with e-mail consent only (F10.7). */
  abandoned_cart_enabled: boolean
  /** How long a cart stays unchanged before it counts as left. */
  abandoned_cart_delay_minutes: number
  /** Categories (and those under them) each feed leaves out (F10.8). */
  feed_exclusions: Record<FeedTargetName, string[]>
  /** An order placed before this hour leaves the same day (Akakçe); null: not promised. */
  feed_same_day_cutoff_hour: number | null
}

/** The icons a promise in the storefront's trust strip may carry (docs/19 §4). */
export const TRUST_ICONS = [
  "truck",
  "clock",
  "shield",
  "card",
  "refresh",
  "award",
  "gift",
  "phone",
] as const
export type TrustIcon = (typeof TRUST_ICONS)[number]

export interface StorefrontLink {
  label: string
  /** A page of the shop (`/hakkimizda`) or an https address. */
  href: string
}

/** The storefront's frame as the shop writes it (F18, docs/19 §4); arrays are saved whole. */
export interface StorefrontSettings {
  /** The lines the announcement bar shows in turn. */
  announcements: string[]
  /** The small links above the header's menu. */
  top_links: StorefrontLink[]
  /** The footer's link columns; none: the storefront lists categories and a help column. */
  footer_groups: { title: string; links: StorefrontLink[] }[]
  /** The shop's promises under the header and beside "add to cart". */
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  /** The number the WhatsApp button opens, E.164; none: no button. */
  whatsapp_phone: string | null
  /** The header's menu as the shop names it; none: the top categories and their children. */
  menu: StorefrontMenuItem[]
  /** The storefront's main colour (`#rrggbb`, lower case); none: the theme's own. */
  primary_color: string | null
  /** The home page's opening; none: the shop's name and its first two categories. */
  hero: StorefrontHero | null
}

export interface StorefrontHero {
  /** A short line above the heading. */
  eyebrow: string | null
  heading: string
  text: string | null
  /** At most two, the first the main button; none: the first two categories. */
  links: StorefrontLink[]
}

export interface StorefrontMenuItem extends StorefrontLink {
  /** The panel it opens; the item's own link comes first in it. */
  children: StorefrontLink[]
}

/** The places the shop's catalog is sent, in the order the panel shows them. */
export const FEED_TARGET_NAMES = ["google", "meta", "cimri", "akakce"] as const
export type FeedTargetName = (typeof FEED_TARGET_NAMES)[number]

export const sectionQuery = <T>(section: string) =>
  queryOptions({
    queryKey: ["settings", section],
    queryFn: () => sdk.client.fetch<SectionResponse<T>>(sectionUrl(section)),
    staleTime: 5 * 60_000,
  })

/** Saves the fields sent over the stored ones; the answer replaces the cache. */
export function useSaveSection<T>(section: string) {
  const client = useQueryClient()
  return useMutation({
    // The owner's sections (bank account, 2FA requirement) ask to prove oneself again
    mutationFn: (values: Partial<T>) =>
      withReauth((extra) =>
        sdk.client.fetch<SectionResponse<T>>(sectionUrl(section), {
          method: "POST",
          body: values,
          ...extra,
        })
      ),
    onSuccess: (saved) => {
      client.setQueryData(["settings", section], saved)
    },
  })
}
