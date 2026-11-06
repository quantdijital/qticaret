import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { siteSeo } from "@/lib/store-api/requests"
import { CATEGORIES_PATH, CategoriesScreen } from "@/screens/indexes"

export async function generateMetadata(): Promise<Metadata> {
  const site = await siteSeo()
  return {
    title: { absolute: `${t("categories.title")} | ${site.shop.name}` },
    description: t("categories.description", { shop: site.shop.name }),
    alternates: site.canonical_host
      ? { canonical: `https://${site.canonical_host}${CATEGORIES_PATH}` }
      : null,
    robots: site.indexing ? "index,follow" : "noindex,nofollow",
  }
}

/** `/kategoriler`: every category as picture tiles, the top ones with those below them. */
export default function Categories() {
  return <CategoriesScreen />
}
