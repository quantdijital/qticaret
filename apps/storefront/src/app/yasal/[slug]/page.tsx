import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { siteSeo } from "@/lib/store-api/requests"
import { isLegalSlug, LEGAL_PAGES, legalDocument, publishedLegalLinks } from "@/lib/views/legal"
import { withOutline } from "@/lib/views/legal-outline"
import { theme } from "@/theme"

type Params = Promise<{ slug: string }>

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const [site, document] = await Promise.all([
    siteSeo(),
    isLegalSlug(slug) ? legalDocument(LEGAL_PAGES[slug]) : null,
  ])
  if (!document) {
    return { robots: "noindex,nofollow" }
  }
  return {
    title: { absolute: `${document.title} | ${site.shop.name}` },
    alternates: site.canonical_host
      ? { canonical: `https://${site.canonical_host}/yasal/${slug}` }
      : null,
    // A legal text is for reading, not for search results
    robots: "noindex,follow",
  }
}

/**
 * `/yasal/:slug` (D10): one of the shop's published legal texts, its
 * headings as a table of contents, the shop's other published texts beside.
 */
export default async function LegalPage({ params }: { params: Params }) {
  const { slug } = await params
  const [document, links] = await Promise.all([
    isLegalSlug(slug) ? legalDocument(LEGAL_PAGES[slug]) : null,
    publishedLegalLinks(),
  ])
  if (!document) {
    notFound()
  }
  const { html, outline } = withOutline(document.html)
  const published = document.published_at ? new Date(document.published_at) : null
  return (
    <theme.LegalPage
      t={t}
      view={{
        title: document.title,
        html,
        outline,
        updated:
          published && !Number.isNaN(published.getTime())
            ? { label: DATE.format(published), dateTime: published.toISOString() }
            : null,
        others: links.filter((link) => link.path !== `/yasal/${slug}`),
        breadcrumbs: [
          { label: t("home.label"), path: "/" },
          { label: document.title, path: null },
        ],
      }}
    />
  )
}
