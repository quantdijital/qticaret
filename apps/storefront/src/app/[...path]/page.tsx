import type { Metadata } from "next"
import { notFound, permanentRedirect, redirect } from "next/navigation"
import { t } from "@/lib/i18n"
import { metadataOf } from "@/lib/seo/metadata"
import { resolvePath } from "@/lib/store-api/requests"
import { pagedSeo } from "@/lib/seo/paging"
import { blogPageOf } from "@/lib/views/blog"
import { collectionsOn } from "@/lib/views/collections-on"
import { EntityScreen } from "@/screens/entity"
import { requestedUrl } from "@/screens/url"

interface CatchAllProps {
  params: Promise<{ path: string[] }>
}

/**
 * Next's own address space (`/_next/static/<no such file>`): Next falls back
 * to this page when no build file lives there, often without the proxy (its
 * matcher skips `_next/static`). Nothing of the shop's lives under `/_next`:
 * a 404 asked of no backend (adr/0053 Ek 2026-11-15). Read from the route's
 * own segments, not the proxy's `x-qt-url`, which a skipped proxy never set.
 */
const isNextOwnPath = async (params: CatchAllProps["params"]) => (await params).path[0] === "_next"

const NOT_FOUND_METADATA: Metadata = {
  title: { absolute: t("not_found.title") },
  robots: "noindex,follow",
}

async function resolution() {
  const url = await requestedUrl()
  return { url, page: await resolvePath(`${url.pathname}${url.search}`) }
}

export async function generateMetadata({ params }: CatchAllProps): Promise<Metadata> {
  if (await isNextOwnPath(params)) {
    return NOT_FOUND_METADATA
  }
  const { url, page } = await resolution()
  // Collections off: a resolve answer cached across the change gets the not-found page's noindex
  if (
    page.type === "entity" &&
    page.entity_type === "product_collection" &&
    !(await collectionsOn())
  ) {
    return NOT_FOUND_METADATA
  }
  if (page.type === "entity" && page.seo) {
    // A list's later page is its own page (docs/13 §3, §7): a listing's number and canonical
    // come from resolve, a blog archive's or author's from the address
    const isArchive =
      page.entity_type === "post_category" ||
      page.entity_type === "post_tag" ||
      page.entity_type === "post_author"
    if (isArchive) {
      const number = blogPageOf(url.searchParams.get("sayfa") ?? undefined) ?? 1
      return metadataOf(pagedSeo(page.seo, number, t, url.pathname))
    }
    return metadataOf(pagedSeo(page.seo, page.listing?.page ?? 1, t))
  }
  return NOT_FOUND_METADATA
}

/**
 * Every address that is not one of the storefront's own pages (adr/0046
 * §3): the backend says what lives there, the theme shows it. Redirects
 * and 410s normally leave from `proxy.ts` with their own codes; these
 * branches only cover a rule saved between the two calls.
 */
export default async function CatchAllPage({ params }: CatchAllProps) {
  if (await isNextOwnPath(params)) {
    return notFound()
  }
  const { url, page } = await resolution()
  switch (page.type) {
    case "redirect":
      return page.status === 301 ? permanentRedirect(page.location) : redirect(page.location)
    case "gone":
    case "not_found":
      return notFound()
    case "entity":
      return <EntityScreen page={page} url={url} />
  }
}
