import type { ListingSort, ListingView } from "@qticaret/types"

/**
 * What this storefront cannot show yet (D4): filters, a price range or a
 * price sort need the backend's listing query. Page and newest sort work.
 */
export function unsupportedListing(listing: ListingView | undefined): boolean {
  if (!listing) {
    return false
  }
  return (
    Object.keys(listing.filters).length > 0 ||
    listing.price !== null ||
    (listing.sort !== null && listing.sort !== "yeni")
  )
}

/**
 * A listing's addresses in the backend's canonical form (docs/13 §7):
 * `sirala` before `sayfa`, no `sayfa=1`, no default sort; anything else
 * would be answered with a 301.
 */
export function listingPaths(pathname: string, sort: ListingSort | null) {
  const build = (order: ListingSort | null, page: number): string => {
    const params = new URLSearchParams()
    if (order) {
      params.set("sirala", order)
    }
    if (page > 1) {
      params.set("sayfa", String(page))
    }
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }
  return {
    page: (page: number) => build(sort, page),
    sorted: (order: ListingSort | null) => build(order, 1),
  }
}
