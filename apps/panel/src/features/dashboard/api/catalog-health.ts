import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** `GET /admin/dashboard/catalog-health`: how complete the catalog is, counts only. */
export interface CatalogHealth {
  products: number
  complete: number
  without_image: number
  without_category: number
  short_description: number
  missing_dimensions: number
  min_description_words: number
  capped: boolean
}

export const catalogHealthQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "catalog-health"],
    queryFn: () => sdk.client.fetch<CatalogHealth>("/admin/dashboard/catalog-health"),
    staleTime: 5 * 60_000,
  })
