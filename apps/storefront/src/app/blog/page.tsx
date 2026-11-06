import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { pageTitle } from "@/lib/seo/paging"
import { siteSeo } from "@/lib/store-api/requests"
import { blogPageOf, blogPagePath } from "@/lib/views/blog"
import { BlogIndexScreen } from "@/screens/blog"
import type { Query } from "@/screens/shop"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Query>
}): Promise<Metadata> {
  const [site, query] = await Promise.all([siteSeo(), searchParams])
  const page = blogPageOf(query["sayfa"]) ?? 1
  const path = blogPagePath("/blog", page)
  return {
    title: {
      absolute: pageTitle(`${t("blog.title")} | ${site.shop.name}`, page, site.shop.name, t),
    },
    description: t("blog.description", { shop: site.shop.name }),
    // docs/13 §7: each page of a list is its own page, its own canonical
    alternates: site.canonical_host ? { canonical: `https://${site.canonical_host}${path}` } : null,
    robots: site.indexing ? "index,follow" : "noindex,nofollow",
  }
}

/** `/blog` (D10): the shop's posts, newest first, twelve a page. */
export default async function BlogIndex({ searchParams }: { searchParams: Promise<Query> }) {
  return <BlogIndexScreen query={await searchParams} />
}
