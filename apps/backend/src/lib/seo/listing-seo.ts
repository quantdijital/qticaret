import { LISTING_PARAMS, isNarrowed } from "./facets"
import type { ListingQuery } from "./facets"
import type { JsonLd } from "./jsonld"
import type { SeoPayload } from "./resolve"

// A numbered page's structured data: its own URL and name, without page one's product list
function pagedJsonLd(blocks: readonly JsonLd[], url: string | null, suffix: string): JsonLd[] {
  return blocks.map((block) => {
    if (block["@type"] !== "CollectionPage") {
      return block
    }
    const rest = Object.fromEntries(Object.entries(block).filter(([key]) => key !== "mainEntity"))
    const name = typeof rest["name"] === "string" ? `${rest["name"]}${suffix}` : rest["name"]
    return { ...rest, name, ...(url ? { url } : {}) }
  })
}

const isSelf = (canonical: string, path: string): boolean => {
  const url = new URL(canonical)
  return url.search === "" && url.pathname === new URL(path, url.origin).pathname
}

/**
 * A listing page's `seo` object for its query (docs/13 §3, §7): a
 * filtered, priced or sorted listing is `noindex,follow`, its canonical
 * the clean page; a numbered page names itself canonical (unless the page
 * names another) and says which page it is in its title and structured
 * data. A stricter robots value stays.
 */
export function listingSeo(payload: SeoPayload, query: ListingQuery, path: string): SeoPayload {
  const suffix = query.page > 1 ? ` - Sayfa ${String(query.page)}` : ""
  const isFiltered = isNarrowed(query)
  const canonical =
    payload.canonical && suffix && !isFiltered && isSelf(payload.canonical, path)
      ? `${payload.canonical}?${LISTING_PARAMS.page}=${String(query.page)}`
      : payload.canonical
  const robots = isFiltered && payload.robots === "index,follow" ? "noindex,follow" : payload.robots
  return {
    ...payload,
    title: `${payload.title}${suffix}`,
    canonical,
    robots,
    openGraph: {
      ...payload.openGraph,
      title: `${payload.openGraph.title}${suffix}`,
      url: canonical,
    },
    twitter: { ...payload.twitter, title: `${payload.twitter.title}${suffix}` },
    jsonLd: suffix ? pagedJsonLd(payload.jsonLd, canonical, suffix) : payload.jsonLd,
  }
}
