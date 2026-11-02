import "server-only"
import { cache } from "react"
import { liraRegion } from "./requests"
import { storeGet } from "./server"

// A listing's products a page at a time (D4), and the site search over them (adr/0046 ek 2026-11-03)

export interface FacetValueAnswer {
  value: string
  label: string
  count: number
  selected: boolean
}

export interface ListingAnswer {
  product_ids: string[]
  count: number
  page: number
  page_size: number
  facets: {
    brands: FacetValueAnswer[]
    attributes: { key: string; label: string; values: FacetValueAnswer[] }[]
    price: { min: number; max: number } | null
  }
  /** A site search's (adr/0046 ek 2026-11-03): "did you mean" phrases, related chips. */
  search?: {
    suggestions: string[]
    related: {
      categories: { id: string; name: string }[]
      brands: { id: string; name: string; handle: string }[]
    }
    took_ms: number
  }
}

/** The listings the listing route answers by id (`sale`: the products on sale now, its id `sale`). */
export type ListingType =
  "product_category" | "product_collection" | "brand" | "landing" | "all" | "sale"

/** One page of a listing with its filters (D4): ids, the count, the filters it offers. */
export async function listingPage(
  type: ListingType,
  id: string,
  query: string
): Promise<ListingAnswer> {
  const region = await liraRegion()
  return storeGet<ListingAnswer>("/store/listings/products", {
    type,
    id,
    region_id: region.id,
    currency_code: region.currency_code,
    query,
  })
}

/**
 * A site search as a listing (`/arama`): the catalogue weighed against
 * `q`, the listing's own query beside it. Once per request: the backend
 * counts the first, unfiltered page for the search report (F11.8).
 */
export const searchPage = cache(async (q: string, query: string): Promise<ListingAnswer> => {
  const region = await liraRegion()
  return storeGet<ListingAnswer>("/store/listings/products", {
    type: "search",
    q,
    region_id: region.id,
    currency_code: region.currency_code,
    query,
  })
})
