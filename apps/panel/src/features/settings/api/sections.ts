import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { SHOP_TOKENS_KEY } from "@/features/settings/api/shop-tokens"
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
  /** A licence its trade asks the shop to show (adr/0076 §12): shown once name and number are given. */
  document_name: string | null
  document_number: string | null
  document_holder: string | null
}

/** One range the shop answers in (adr/0048): ISO weekday 1 (Monday) … 7, `HH:MM`, `closes` up to `24:00`. */
export interface OpeningRange {
  day: number
  opens: string
  closes: string
}

/** The shop's own details (adr/0048): with the legal section, the one source every page reads. */
export interface StoreSettings {
  contact_email: string | null
  /** E.164; the server accepts Turkish forms and normalises them. */
  contact_phone: string | null
  /** The number the storefront's WhatsApp buttons open, E.164; none: no button. */
  whatsapp_phone: string | null
  /** Sorted by day and opening; a day without a range is closed, none at all: not given. */
  opening_hours: OpeningRange[]
  /** The shop on a map (Google Maps and the like), https; none: no link. */
  map_url: string | null
  /** The QR code ETBİS gives (eticaret.gov.tr), from the media library; the storefront's footer shows it. */
  etbis_qr_url: string | null
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
/** T1: what listings do with sold-out products (the server's closed list). */
export type OutOfStockListing = "show" | "hide"

export interface InventorySettings {
  low_stock_threshold: number
  /** Absent from an older backend: `show`. */
  out_of_stock_listing?: OutOfStockListing
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
  /**
   * An order placed before this hour leaves the same day (the product
   * page's card, Akakçe); null: not set here, the legacy feed rule's stands.
   */
  same_day_cutoff_hour: number | null
  rate_table: { max_desi: number; price: number }[]
  over_desi_price: number
  /** The page labels print on: a label printer's roll, or A4 with four to a sheet. */
  label_format: LabelFormat
  /** The roll's size when `label_format` is `custom`. */
  label_custom: { width_mm: number; height_mm: number }
  /**
   * The parcel a product without measures ships as, in the shop's units
   * (adr/0054); null: the platform's, `PLATFORM_PARCEL`.
   */
  default_parcel: { weight: number; length: number; width: number; height: number } | null
  /** Whether packing slips print the lines' prices and the order's totals; off by default. */
  packing_slip_prices: boolean
  /** The shop's own shipping classes (adr/0087); absent from an older backend: none. */
  shipping_classes?: ShippingClass[]
}

/** A shop's shipping class (adr/0087 §1): its key on products, its name, its surcharge in kuruş. */
export interface ShippingClass {
  key: string
  name: string
  surcharge: number
}

/** The built-in class: the product ships free; never renamed, never removed. */
export const FREE_SHIPPING_CLASS = "free"

/** The platform's default parcel in grams and cm (the backend's `PLATFORM_PARCEL`, adr/0054). */
export const PLATFORM_PARCEL = { weight_g: 1000, length_cm: 30, width_cm: 20, height_cm: 10 }

/** Return rules (F13.4, adr/0041): the right of withdrawal's days and who pays the return. */
export interface ReturnsSettings {
  /** The law's 14 days or longer; the return policy's {iade_süresi} reads it. */
  withdrawal_days: number
  /**
   * Always the shop since 1.1.2026 (adr/0032 Ek 2026-11-03: MSY md. 12/5,
   * md. 13/3 repealed): "customer" is refused with 400
   * `platform_settings.return_shipping_shop_only`. Read, never sent.
   */
  return_shipping: "shop"
  /**
   * The shop sells package travel (adr/0076 §8): a dated booking cancelled
   * 30 days or more ahead keeps nothing; the refund comes within 14 days.
   */
  package_travel: boolean
}

export const MIN_WITHDRAWAL_DAYS = 14

/**
 * The simple path of dated products (adr/0076 Ek basit yol): the shop may
 * run without vouchers or the shopper's online cancel, its own note shown
 * instead (null: the default sentence). Counts only while dated selling is on.
 */
export interface BookingFlowSettings {
  voucher_enabled: boolean
  voucher_off_note: string | null
  online_cancel_enabled: boolean
  cancel_off_note: string | null
}

export const BOOKING_NOTE_MAX = 500

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
  url_style: { product: UrlStyle; category: UrlStyle | "nested"; brand: UrlStyle }
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
  /** A message from the storefront's contact form (adr/0047); on by default. */
  alert_contact_message: boolean
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
  /**
   * Legacy: the same-day hour before it moved to `ShippingSettings`
   * (adr/0046 Ek 2026-11-06). Read while Kargo's is unset; cleared when
   * the shop saves the hour there.
   */
  feed_same_day_cutoff_hour: number | null
  /** One bulk message (adr/0050) a recipient in 24 hours at most. */
  campaign_frequency_cap: boolean
  /** Bulk texts go from this hour (Türkiye) ... */
  campaign_sms_start_hour: number
  /** ... until before this one (1–24); outside, a sending SMS campaign waits. */
  campaign_sms_end_hour: number
  /** The way to refuse added to every bulk SMS (80 at most); none: no SMS campaign starts. */
  sms_opt_out_text: string | null
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

/**
 * The storefront's frame as the shop writes it (F18, docs/19 §4); arrays
 * are saved whole. Its menus are records of their own (adr/0049,
 * features/storefront/api/menus.ts).
 */
export interface StorefrontSettings {
  /** The lines the announcement bar shows in turn. */
  announcements: string[]
  /** The shop's promises under the header and beside "add to cart". */
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  /** The storefront's main colour (`#rrggbb`, lower case); none: the theme's own. */
  primary_color: string | null
  /** The home page's opening; none: the shop's name and its first two categories. */
  hero: StorefrontHero | null
  /**
   * The content page that carries the contact form below its text
   * (adr/0047), and the pages the storefront shows its live payment facts
   * (ways to pay, installment rates) and shipping facts (carriers,
   * promises) beside (adr/0046 Ek 2026-11-05): by the page's id, so a page
   * whose address changes keeps its role (adr/0073 Açık kararlar 3).
   * None: the old path below names it, if it does; else no page.
   */
  contact_page_id: string | null
  payment_page_id: string | null
  shipping_page_id: string | null
  /** The roles by path, from before the ids: read only while the role's id is none. */
  contact_form_path: string | null
  payment_info_path: string | null
  shipping_info_path: string | null
  /** The shop's colour names: an option or filter value that reads as one shows as a swatch. */
  color_swatches: StorefrontColorSwatch[]
  /** A product card says "Az kaldı" at or under this many (never the number); 0: never. */
  low_stock_threshold: number
}

/** A colour name and its colour (`#rrggbb`, lower case); names are unique in Turkish case. */
export interface StorefrontColorSwatch {
  label: string
  hex: string
}

export interface StorefrontHero {
  /** A short line above the heading. */
  eyebrow: string | null
  heading: string
  text: string | null
  /** At most two, the first the main button; none: the first two categories. */
  links: StorefrontLink[]
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
      // A shop detail a text stands in for may have changed (adr/0048)
      void client.invalidateQueries({ queryKey: SHOP_TOKENS_KEY })
    },
  })
}
