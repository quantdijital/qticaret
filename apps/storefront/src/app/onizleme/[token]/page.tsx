import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache } from "react"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { isStoreApiError } from "@/lib/store-api/errors"
import { layoutPreview } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { homeSections } from "@/lib/views/home"
import { theme } from "@/theme"

type Params = Promise<{ token: string }>

interface PreviewEntry {
  title: string
  html: string
  published_at: string | null
}

const TOKEN = /^cnt_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}$/
// The theme editor's draft (adr/0049)
const LAYOUT_TOKEN = /^sfl_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}$/

/** The entry a signed link opens; null for one malformed, changed or past its day. */
const previewOf = cache(async (token: string): Promise<PreviewEntry | null> => {
  if (!TOKEN.test(token)) {
    return null
  }
  try {
    const { entry } = await storeGet<{ entry: PreviewEntry }>(
      `/store/content/preview/${encodeURIComponent(token)}`
    )
    return entry
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params
  const found = LAYOUT_TOKEN.test(token)
    ? (await layoutPreview(token)) && t("preview.design")
    : (await previewOf(token))?.title
  return {
    title: { absolute: found ? t("preview.title", { title: found }) : t("preview.gone") },
    // A preview is nobody's search result, nor a page to follow links from
    robots: "noindex,nofollow",
    referrer: "no-referrer",
  }
}

/**
 * `/onizleme/:token` (F18): a content page or post as it will read, draft
 * or not, or the theme editor's draft home page with its header and footer
 * (adr/0049), from a link staff made in the panel (a day). Never indexed.
 */
export default async function PreviewPage({ params }: { params: Params }) {
  const { token } = await params
  if (LAYOUT_TOKEN.test(token)) {
    const layout = await layoutPreview(token)
    if (!layout) {
      notFound()
    }
    const sections = await homeSections(layout.home, t)
    return (
      <theme.HomePage
        t={t}
        view={{ sections, notice: t("preview.design_notice") }}
        subscribe={subscribeNewsletter}
      />
    )
  }
  const entry = await previewOf(token)
  if (!entry) {
    notFound()
  }
  return (
    <theme.ContentPage
      t={t}
      view={{
        title: entry.title,
        html: entry.html,
        publishedAt: entry.published_at,
        breadcrumbs: [],
        notice: t("preview.notice"),
      }}
    />
  )
}
