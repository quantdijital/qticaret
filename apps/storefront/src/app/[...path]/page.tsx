import type { Metadata } from "next"
import { notFound, permanentRedirect, redirect } from "next/navigation"
import { t } from "@/lib/i18n"
import { metadataOf } from "@/lib/seo/metadata"
import { resolvePath } from "@/lib/store-api/requests"
import { pagedSeo } from "@/lib/seo/paging"
import { blogPageOf } from "@/lib/views/blog"
import { EntityScreen } from "@/screens/entity"
import { requestedUrl } from "@/screens/url"

async function resolution() {
  const url = await requestedUrl()
  return { url, page: await resolvePath(`${url.pathname}${url.search}`) }
}

export async function generateMetadata(): Promise<Metadata> {
  const { url, page } = await resolution()
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
      return <EntityScreen page={page} url={url} />
  }
}
