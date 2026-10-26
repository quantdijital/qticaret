import type { MedusaContainer } from "@medusajs/framework/types"
import { LISTING_PAGE_SIZE } from "../../lib/seo/facets"
import type { ListingQuery } from "../../lib/seo/facets"
import { listingSeo } from "../../lib/seo/listing-seo"
import { parseRequestPath } from "../../lib/seo/redirects"
import type { RequestPath } from "../../lib/seo/redirects"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../catalog/entity-paths"
import { listingAnswer } from "./listing"
import { seoPayloadFor } from "./payload"
import { ownerState } from "./redirects/owners"
import type { Resolution } from "./redirects/resolve"

/** A listing's query as the storefront asks for its products (F3.17). */
export interface ListingView {
  filters: Record<string, string[]>
  price: ListingQuery["price"]
  sort: ListingQuery["sort"]
  page: number
  /** Products per page: a later page than the products fill is not found. */
  page_size: number
}

const viewOf = (query: ListingQuery): ListingView => ({
  filters: Object.fromEntries(query.filters),
  price: query.price,
  sort: query.sort,
  page: query.page,
  page_size: LISTING_PAGE_SIZE,
})

type Page = Extract<Resolution, { type: "entity" }>

/**
 * A live page with its `seo` object; a listing's query answered first
 * (F3.17): put in canonical order, sent to a landing page, not found, or
 * read into the page's `listing` and its `seo` object.
 */
export async function pageWithQuery(
  container: MedusaContainer,
  page: Page,
  request: RequestPath
): Promise<Resolution> {
  const listing = await listingAnswer(container, page, request)
  if (listing.kind === "redirect") {
    return { type: "redirect", path: page.path, status: 301, location: listing.location }
  }
  if (listing.kind === "not_found") {
    return { type: "not_found", path: page.path }
  }
  const seo = await seoPayloadFor(container, page, page.path)
  if (listing.kind === "plain") {
    return { ...page, seo }
  }
  return {
    ...page,
    seo: seo ? listingSeo(seo, listing.query, page.path) : seo,
    listing: viewOf(listing.query),
  }
}

/**
 * A redirect whose target is a live listing with a query its listing
 * would send on (a filter with a landing page, another order): straight
 * there, so the storefront still answers in one hop.
 */
export async function redirectThroughListing(
  container: MedusaContainer,
  redirect: Extract<Resolution, { type: "redirect" }>
): Promise<Resolution> {
  const target = parseRequestPath(redirect.location)
  if (!target || target.query.size === 0) {
    return redirect
  }
  const entry = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .resolvePath({ locale: CATALOG_LOCALE, path: target.path })
  if (entry?.status !== "active" || (await ownerState(container, entry)).kind !== "live") {
    return redirect
  }
  const listing = await listingAnswer(container, entry, target)
  return listing.kind === "redirect" ? { ...redirect, location: listing.location } : redirect
}
