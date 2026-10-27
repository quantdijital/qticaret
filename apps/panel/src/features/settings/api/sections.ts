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
