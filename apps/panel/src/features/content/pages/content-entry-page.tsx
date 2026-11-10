import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import { contentQuery } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { ContentActions } from "@/features/content/components/content-actions"
import { ContentBodyCard } from "@/features/content/components/content-body-card"
import { ContentGeneralCard } from "@/features/content/components/content-general-card"
import { ContentSideCards } from "@/features/content/components/content-side-cards"
import { EditorLayout } from "@/features/content/components/editor-layout"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { CONTENT_SECTIONS as S, CONTENT_TARGETS } from "@/features/content/content-sections"
import { docText } from "@/features/content/doc-text"
import { findingsNote, useSectionFindings } from "@/features/content/section-findings"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/content/$id")

function Dates({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const rows = [
    ["published", entry.published_at],
    ["revised", entry.revised_at],
  ] as const
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border bg-card p-4 text-[13px] shadow-card">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{t(`content.dates.${key}`)}</dt>
          <dd className="text-right tabular-nums">{value ? formatDateTime(value) : "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

// The search appearance, folded under the text: a line until opened
function SeoSection({ data }: { data: ContentDetail }) {
  const { t } = useTranslation()
  const findings = useSectionFindings({
    kind: data.kind,
    id: data.id,
    version: data.updated_at,
    targets: CONTENT_TARGETS,
  })
  const seo = findings(S.seo)
  return (
    <SeoCard
      type={data.kind}
      id={data.id}
      context={{
        path: data.path,
        tokens: { başlık: data.title },
        fallbackDescription: excerpt(data.excerpt ?? docText(data.body), DESCRIPTION_EXCERPT),
      }}
      collapse={{
        id: S.seo,
        name: "content.seo",
        note: findingsNote(t, seo),
        attention: seo.attention,
      }}
    />
  )
}

/**
 * A content page or blog post (F3.16, docs/06 "Metin sayfaları"): its
 * title and text first, its search appearance folded under them; beside
 * them, as the product page's column has its own, its dates, the SEO
 * advisor, the cover, the summary and a post's category and tags. Below `xl` one column: the text, the dates, the cover, the
 * summary and the filing, then the search appearance and the advisor.
 */
export function ContentEntryPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const entry = useQuery(contentQuery(id))
  if (entry.isError) {
    return <ErrorState text={errorText(t, entry.error)} onRetry={() => void entry.refetch()} />
  }
  if (!entry.data) {
    return <LoadingRows rows={8} />
  }
  const data = entry.data
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        back={{
          to: "/content",
          search: data.kind === "post" ? { kind: "post" } : {},
          label: t(`content.tabs.${data.kind}`),
        }}
        title={data.title}
        description={data.path}
        badge={<ContentStatusBadge status={data.status} />}
        action={<ContentActions entry={data} />}
      />
      <EditorLayout
        merge
        main={
          <>
            <div id={S.general} className="scroll-mt-20">
              <ContentGeneralCard entry={data} />
            </div>
            <div id={S.body} className="scroll-mt-20">
              <ContentBodyCard entry={data} />
            </div>
            {/* On a narrower screen after the cover, the summary and the filing (`merge`) */}
            <div className="order-1 flex min-w-0 flex-col xl:order-none">
              <SeoSection data={data} />
            </div>
          </>
        }
        side={
          <>
            <Dates entry={data} />
            {/* Under the dates beside the text; on a narrower screen last of all */}
            <div className="order-2 flex min-w-0 flex-col xl:order-none">
              <AdvisorCard
                kind={data.kind}
                id={data.id}
                version={data.updated_at}
                targets={CONTENT_TARGETS}
                onTarget={revealSection}
              />
            </div>
            <ContentSideCards entry={data} />
          </>
        }
      />
    </div>
  )
}
