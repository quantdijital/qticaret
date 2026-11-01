import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache } from "react"
import { t } from "@/lib/i18n"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"
import { theme } from "@/theme"

type Params = Promise<{ token: string }>

interface PreviewEntry {
  title: string
  html: string
  published_at: string | null
}

const TOKEN = /^cnt_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}$/

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
  const entry = await previewOf((await params).token)
  return {
    title: { absolute: entry ? t("preview.title", { title: entry.title }) : t("preview.gone") },
    // A preview is nobody's search result, nor a page to follow links from
    robots: "noindex,nofollow",
    referrer: "no-referrer",
  }
}

/**
 * `/onizleme/:token` (F18): a content page or post as it will read, draft
 * or not, from the link staff made in the panel (a day). Never indexed.
 */
export default async function PreviewPage({ params }: { params: Params }) {
  const entry = await previewOf((await params).token)
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
