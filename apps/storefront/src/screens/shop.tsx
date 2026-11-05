import { headers } from "next/headers"
import { t } from "@/lib/i18n"
import { breadcrumbJsonLd } from "@/lib/seo/breadcrumbs"
import { listingPage } from "@/lib/store-api/listings"
import { siteSeo } from "@/lib/store-api/requests"
import { categoryTiles } from "@/lib/views/category-tiles"
import { searchOf, stateFromSearch } from "@/lib/views/listing"
import { ListingContent } from "./listing"

/** A page's query as Next gives it (`searchParams`). */
export type Query = Record<string, string | string[] | undefined>

export const toSearch = (query: Query) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const each of typeof value === "string" ? [value] : (value ?? [])) {
      search.append(key, each)
    }
  }
  return search
}

/** The other way round: an address's query as a page's (for the design preview, adr/0049). */
export const queryOf = (search: URLSearchParams): Query => {
  const query: Query = {}
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key)
    query[key] = values.length === 1 ? values[0] : values
  }
  return query
}

/** `/magaza` (D4): the whole catalogue, with the filters and sorts every listing has. */
export async function ShopScreen({ query }: { query: Query }) {
  const site = await siteSeo()
  const state = stateFromSearch(toSearch(query))
  const incoming = await headers()
  const origin = incoming.get("host") ? `http://${incoming.get("host") ?? ""}` : "http://localhost"
  const search = searchOf(state)
  const url = new URL(`/magaza${search ? `?${search}` : ""}`, origin)
  // The price form's fields ride along as the address had them
  for (const key of ["fiyat_en_az", "fiyat_en_cok"]) {
    const value = query[key]
    if (typeof value === "string") {
      url.searchParams.set(key, value)
    }
  }
  return (
    <ListingContent
      type="all"
      load={(listing) => listingPage("all", "all", listing)}
      state={state}
      url={url}
      heading={async () => ({
        title: t("listing.all_products"),
        description: [],
        // The shop's top categories as the catalogue's aisles, each with its picture
        subcategories: await categoryTiles([]),
      })}
      breadcrumbs={(title) => [
        { label: t("home.label"), path: "/" },
        { label: title, path: null },
      ]}
      jsonLd={breadcrumbJsonLd(site.canonical_host, [
        { name: t("home.label"), path: "/" },
        { name: t("listing.all_products"), path: "/magaza" },
      ])}
    />
  )
}
