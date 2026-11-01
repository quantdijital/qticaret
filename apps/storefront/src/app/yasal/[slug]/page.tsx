import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { siteSeo } from "@/lib/store-api/requests"
import { isLegalSlug, LEGAL_PAGES, legalDocument } from "@/lib/views/legal"
import { theme } from "@/theme"

type Params = Promise<{ slug: string }>

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

/** `/yasal/:slug` (D10): one of the shop's published legal texts. */
export default async function LegalPage({ params }: { params: Params }) {
  const { slug } = await params
  const document = isLegalSlug(slug) ? await legalDocument(LEGAL_PAGES[slug]) : null
  if (!document) {
    notFound()
  }
  return (
    <theme.ContentPage
      t={t}
      view={{
        title: document.title,
        html: document.html,
        publishedAt: document.published_at,
        breadcrumbs: [
          { label: t("home.label"), path: "/" },
          { label: document.title, path: null },
        ],
      }}
    />
  )
}
