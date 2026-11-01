import type { Metadata } from "next"
import { notFound, permanentRedirect, redirect } from "next/navigation"
import { t } from "@/lib/i18n"
import { metadataOf } from "@/lib/seo/metadata"
import { resolvePath } from "@/lib/store-api/requests"
import { ContentScreen } from "@/screens/content"
import { ListingScreen } from "@/screens/listing"
import { ProductScreen } from "@/screens/product"
import { requestedUrl } from "@/screens/url"

async function resolution() {
  const url = await requestedUrl()
  return { url, page: await resolvePath(`${url.pathname}${url.search}`) }
}

export async function generateMetadata(): Promise<Metadata> {
  const { page } = await resolution()
  if (page.type === "entity" && page.seo) {
    return metadataOf(page.seo)
  }
  return { title: { absolute: t("not_found.title") }, robots: "noindex,follow" }
}

/**
 * Every address that is not one of the storefront's own pages (adr/0046
 * §3): the backend says what lives there, the theme shows it. Redirects
 * and 410s normally leave from `proxy.ts` with their own codes; these
 * branches only cover a rule saved between the two calls.
 */
export default async function CatchAllPage() {
  const { url, page } = await resolution()
  switch (page.type) {
    case "redirect":
      return page.status === 301 ? permanentRedirect(page.location) : redirect(page.location)
    case "gone":
    case "not_found":
      return notFound()
    case "entity":
      switch (page.entity_type) {
        case "product":
          return <ProductScreen page={page} url={url} />
        case "page":
        case "post":
          return <ContentScreen page={page} />
        case "product_category":
        case "product_collection":
        case "brand":
        case "landing":
          return <ListingScreen page={page} url={url} />
      }
  }
}
