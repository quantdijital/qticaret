import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A platform settings section as stored, defaults filled in (adr/0012). */
export interface SectionResponse<T> {
  section: string
  values: T
  version: number
}

export interface StoreSettings {
  contact_email: string | null
  /** E.164; the server accepts Turkish forms and normalises them. */
  contact_phone: string | null
  timezone: string
  weight_unit: "g" | "kg"
  dimension_unit: "cm" | "mm"
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
}

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
    mutationFn: (values: Partial<T>) =>
      sdk.client.fetch<SectionResponse<T>>(sectionUrl(section), { method: "POST", body: values }),
    onSuccess: (saved) => {
      client.setQueryData(["settings", section], saved)
    },
  })
}
