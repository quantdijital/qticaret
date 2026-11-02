import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { SearchScreen } from "@/screens/search"
import type { Query } from "@/screens/shop"

// docs/13 §7: search results are noindex,follow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,follow", t("search.title"))

/** `/arama?q=` (adr/0046 ek 2026-11-03): the site search as a listing. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Query> }) {
  return <SearchScreen query={await searchParams} />
}
