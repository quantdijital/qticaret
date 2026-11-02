import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { siteSeo } from "@/lib/store-api/requests"
import { BRANDS_PATH, BrandsScreen } from "@/screens/indexes"

export async function generateMetadata(): Promise<Metadata> {
  const site = await siteSeo()
  return {
    title: { absolute: `${t("brands.title")} | ${site.shop.name}` },
    description: t("brands.description", { shop: site.shop.name }),
    alternates: site.canonical_host
      ? { canonical: `https://${site.canonical_host}${BRANDS_PATH}` }
      : null,
    robots: site.indexing ? "index,follow" : "noindex,nofollow",
  }
}

/** `/markalar`: every brand by first letter. */
export default function Brands() {
  return <BrandsScreen />
}
