import type { Metadata } from "next"
import { notFound, permanentRedirect, redirect } from "next/navigation"
import { t } from "@/lib/i18n"
import { metadataOf } from "@/lib/seo/metadata"
import { resolvePath } from "@/lib/store-api/requests"
import { blogPageOf, pagedSeo } from "@/lib/views/blog"
import { EntityScreen } from "@/screens/entity"
import { requestedUrl } from "@/screens/url"

async function resolution() {
  const url = await requestedUrl()
  return { url, page: await resolvePath(`${url.pathname}${url.search}`) }
}

export async function generateMetadata(): Promise<Metadata> {
  const { url, page } = await resolution()
  if (page.type === "entity" && page.seo) {
    // A blog archive's later page is its own page (docs/13 §7); listings come paged from resolve
    const isArchive = page.entity_type === "post_category" || page.entity_type === "post_tag"
    const number = isArchive ? (blogPageOf(url.searchParams.get("sayfa") ?? undefined) ?? 1) : 1
    return metadataOf(pagedSeo(page.seo, url.pathname, number, t))
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
