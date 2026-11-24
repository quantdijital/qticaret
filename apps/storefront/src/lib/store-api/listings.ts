import "server-only"
import { cache } from "react"
import type { StoreDepartureCalendar } from "@qticaret/types"
import { liraRegion } from "./requests"
import { storeGet, storePublicGet } from "./server"

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
    /**
     * `stok=var` (adr/0056): how many the list holds in stock, counted
     * without that filter, and whether it is on. Optional: an older
     * backend leaves it out and the toggle is not offered.
     */
    stock?: { count: number; selected: boolean }
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
  /**
   * The listing's query in canonical form (adr/0077 §2), when the one
   * asked was not: the page moves there with one 301.
   */
  canonical_query?: string
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
 * `q`, the listing's own query beside it. Without words (`null`) the
 * query's category, dates or filters narrow the whole catalogue (adr/0077
 * §2). Once per request: the backend counts the first, unfiltered page
 * for the search report (F11.8).
 */
export const searchPage = cache(async (q: string | null, query: string): Promise<ListingAnswer> => {
  const region = await liraRegion()
  return storeGet<ListingAnswer>("/store/listings/products", {
    type: "search",
    ...(q ? { q } : {}),
    region_id: region.id,
    currency_code: region.currency_code,
    query,
  })
})

/** The live search's read (`/store/listings/suggest`): the first few hits as ids, and its help. */
export interface SuggestAnswer {
  product_ids: string[]
  count: number
  suggestions: string[]
  related: NonNullable<ListingAnswer["search"]>["related"]
}

/**
 * The header's live search, as the shopper types: the same search as
 * `/arama`, never counted for the report. Shop-wide (the sales channel is
 * the shop's key, no customer's), so each set of words is kept a minute
 * in this process for everyone: a word asked again, or by the next
 * shopper, costs the backend nothing.
 */
export async function suggestPage(q: string): Promise<SuggestAnswer> {
  const region = await liraRegion()
  return storePublicGet<SuggestAnswer>("/store/listings/suggest", {
    q,
    region_id: region.id,
    currency_code: region.currency_code,
  })
}

/**
 * A month of the search's calendar (adr/0077 §6): each day with a departure
 * a date search would match and its lowest guest price, lira only. Shop-wide
 * (the guest's price, the shop's key), so kept a minute in this process as
 * the backend keeps it.
 */
export function departureCalendar(query: Record<string, string>): Promise<StoreDepartureCalendar> {
  return storePublicGet<StoreDepartureCalendar>("/store/departures/calendar", query)
}
