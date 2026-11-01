import type { Resolution } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import { storeGet } from "@/lib/store-api/server"
import { breadcrumbsOf } from "@/lib/views/product"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

interface ContentEntry {
  id: string
  title: string
  html: string
  published_at: string | null
}

/** A content page or blog post (F3.16): the backend's sanitised HTML (adr/0019). */
export async function ContentScreen({ page }: { page: Entity }) {
  const { entry } = await storeGet<{ entry: ContentEntry }>(
    `/store/content/${encodeURIComponent(page.entity_id)}`
  )
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      <theme.ContentPage
        t={t}
        view={{
          title: entry.title,
          html: entry.html,
          publishedAt: entry.published_at,
          breadcrumbs: breadcrumbsOf(page.seo, t("home.label"), entry.title),
        }}
      />
    </>
  )
}
