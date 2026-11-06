import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { pageTitle } from "@/lib/seo/paging"
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
  // Filters (`stok=var` among them), a price range or a sort narrow the list
  const narrowed = state.filters.length > 0 || state.price !== null || state.sort !== null
  // docs/13 §7: a narrowed list's canonical is the clean page; a plain numbered page names itself
  const path = state.page > 1 && !narrowed ? `/magaza?sayfa=${String(state.page)}` : "/magaza"
  return {
    title: {
      absolute: pageTitle(
        `${t("listing.all_products")} | ${site.shop.name}`,
        state.page,
        site.shop.name,
        t
      ),
    },
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
