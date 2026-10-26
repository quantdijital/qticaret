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

type UrlStyle = "prefixed" | "flat"

export interface SeoSettings {
  canonical_host: string | null
  url_style: { product: UrlStyle; category: UrlStyle; brand: UrlStyle }
  title_templates: { product: string; category: string; brand: string }
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
