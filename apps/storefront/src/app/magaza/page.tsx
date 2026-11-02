import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { siteSeo } from "@/lib/store-api/requests"
import { stateFromSearch } from "@/lib/views/listing"
import { type Query, ShopScreen, toSearch } from "@/screens/shop"

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
    description: t("listing.all_products_description", { shop: site.shop.name }),
    alternates: site.canonical_host ? { canonical: `https://${site.canonical_host}${path}` } : null,
    // docs/13 §7: a narrowed or reordered list is not indexed; its pages are
    robots: !site.indexing ? "noindex,nofollow" : narrowed ? "noindex,follow" : "index,follow",
  }
}

/** `/magaza` (D4): the whole catalogue, with the filters and sorts every listing has. */
export default async function Shop({ searchParams }: { searchParams: Promise<Query> }) {
  return <ShopScreen query={await searchParams} />
}
