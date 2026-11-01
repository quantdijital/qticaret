import type { Metadata } from "next"
import { headers } from "next/headers"
import { t } from "@/lib/i18n"
import { siteSeo } from "@/lib/store-api/requests"
import { searchOf, stateFromSearch } from "@/lib/views/listing"
import { ListingContent } from "@/screens/listing"

type Query = Record<string, string | string[] | undefined>

const toSearch = (query: Query) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const each of typeof value === "string" ? [value] : (value ?? [])) {
      search.append(key, each)
    }
  }
  return search
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Query>
}): Promise<Metadata> {
  const [site, query] = await Promise.all([siteSeo(), searchParams])
  const state = stateFromSearch(toSearch(query))
  const narrowed = state.filters.length > 0 || state.price !== null || state.sort !== null
  const path = state.page > 1 ? `/magaza?sayfa=${String(state.page)}` : "/magaza"
  return {
    title: { absolute: `${t("listing.all_products")} | ${site.shop.name}` },
    alternates: site.canonical_host ? { canonical: `https://${site.canonical_host}${path}` } : null,
    // docs/13 §7: a narrowed or reordered list is not indexed; its pages are
    robots: !site.indexing ? "noindex,nofollow" : narrowed ? "noindex,follow" : "index,follow",
  }
}

/** `/magaza` (D4): the whole catalogue, with the filters and sorts every listing has. */
export default async function Shop({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
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
      id="all"
      state={state}
      url={url}
      heading={() =>
        Promise.resolve({ title: t("listing.all_products"), description: [], subcategories: [] })
      }
      breadcrumbs={(title) => [
        { label: t("home.label"), path: "/" },
        { label: title, path: null },
      ]}
      jsonLd={[]}
    />
  )
}
