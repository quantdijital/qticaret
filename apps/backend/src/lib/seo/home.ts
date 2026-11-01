import type { JsonLd } from "./jsonld"
import type { SeoPayload, SeoShop } from "./resolve"

export interface HomeSeoInput {
  shop: Pick<SeoShop, "name" | "canonicalHost" | "indexing">
  /** The shop's own words for its home page (`seo.home`); null falls back. */
  home: { title: string | null; description: string | null }
  /** The shop's share image (`seo.default_og_image`). */
  ogImage: string | null
  /** The home page's `OnlineStore` and `WebSite` (`siteJsonLd`). */
  jsonLd: JsonLd[]
}

/**
 * The home page's `seo` object (F18, adr/0046): the same shape every other
 * page gets from resolve, so the storefront prints it the same way. The
 * title is the shop's own or its name; no description is made up. Like
 * every page, no canonical URL until the canonical host is set, and
 * `noindex,nofollow` on an instance that must not be indexed.
 */
export function homeSeo({ shop, home, ogImage, jsonLd }: HomeSeoInput): SeoPayload {
  const title = home.title ?? shop.name
  const description = home.description ?? ""
  const canonical = shop.canonicalHost ? `https://${shop.canonicalHost}/` : null
  return {
    title,
    description,
    canonical,
    robots: shop.indexing ? "index,follow" : "noindex,nofollow",
    openGraph: {
      title,
      description,
      image: ogImage,
      imageAlt: null,
      type: "website",
      url: canonical,
      siteName: shop.name,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      image: ogImage,
    },
    breadcrumbs: [],
    jsonLd: canonical ? jsonLd : [],
    hreflang: [],
  }
}
