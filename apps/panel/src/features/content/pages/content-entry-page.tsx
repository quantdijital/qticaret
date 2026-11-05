import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { revealSection } from "@/components/patterns/use-section-open"
import { contentQuery } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { ContentActions } from "@/features/content/components/content-actions"
import { ContentBodyCard } from "@/features/content/components/content-body-card"
import { ContentCoverCard } from "@/features/content/components/content-cover-card"
import { ContentGeneralCard } from "@/features/content/components/content-general-card"
import { ContentSummaryCard } from "@/features/content/components/content-summary-card"
import { EditorLayout } from "@/features/content/components/editor-layout"
import { PostTermsCard } from "@/features/content/components/post-terms-card"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { docText } from "@/features/content/doc-text"
import { findingsNote, useSectionFindings } from "@/features/content/section-findings"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"

const route = getRouteApi("/_auth/content/$id")

// The advisor's "go to field" targets: the sections below by their ids (a folded one opens)
const TARGETS = {
  edit_title: "content-seo",
  edit_description: "content-seo",
  edit_robots: "content-seo",
  use_template_title: "content-seo",
  use_template_description: "content-seo",
  edit_body: "content-body",
  edit_handle: "content-general",
  edit_author: "content-summary",
  add_image: "content-cover-section",
}

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

// The page's secondary parts, folded under its text: each a line until opened
function Sections({ data }: { data: ContentDetail }) {
  const { t } = useTranslation()
  const findings = useSectionFindings({
    kind: data.kind,
    id: data.id,
    version: data.updated_at,
    targets: TARGETS,
  })
  const seo = findings("content-seo")
  return (
    <>
      <SeoCard
        type={data.kind}
        id={data.id}
        context={{
          path: data.path,
          tokens: { başlık: data.title },
          fallbackDescription: excerpt(data.excerpt ?? docText(data.body), DESCRIPTION_EXCERPT),
        }}
        collapse={{
          id: "content-seo",
          name: "content.seo",
          note: findingsNote(t, seo),
          attention: seo.attention,
        }}
      />
      <ContentSummaryCard entry={data} findings={findings("content-summary")} />
      <ContentCoverCard entry={data} findings={findings("content-cover-section")} />
      {data.kind === "post" ? (
        <PostTermsCard entry={data} findings={findings("content-terms")} />
      ) : null}
    </>
  )
}

/**
 * A content page or blog post (F3.16): its title and text first, its
 * search appearance, summary, cover and filing folded under them, its
 * dates and the SEO advisor beside them, following the scroll.
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
        main={
          <>
            <div id="content-general" className="scroll-mt-20">
              <ContentGeneralCard entry={data} />
            </div>
            <div id="content-body" className="scroll-mt-20">
              <ContentBodyCard entry={data} />
            </div>
            <Sections data={data} />
          </>
        }
        side={
          <>
            <Dates entry={data} />
            <AdvisorCard
              kind={data.kind}
              id={data.id}
              version={data.updated_at}
              targets={TARGETS}
              onTarget={revealSection}
            />
          </>
        }
      />
    </div>
  )
}
