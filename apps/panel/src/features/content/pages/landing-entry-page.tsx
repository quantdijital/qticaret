import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { revealSection } from "@qticaret/admin-ui/hooks/use-section-open"
import { landingQuery, useUpdateLanding } from "@/features/content/api/landings"
import type { LandingDetail } from "@/features/content/api/landings"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { DocumentCard } from "@/features/content/components/document-card"
import { EditorLayout } from "@/features/content/components/editor-layout"
import { LandingActions } from "@/features/content/components/landing-actions"
import { LandingGeneralCard } from "@/features/content/components/landing-general-card"
import { LandingStandingCard } from "@/features/content/components/landing-standing-card"
import { docText } from "@/features/content/doc-text"
import { findingsNote, useSectionFindings } from "@/features/content/section-findings"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/content/landings/$id")

// The advisor's "go to field" targets (a folded section opens)
const TARGETS = {
  edit_title: "landing-seo",
  edit_description: "landing-seo",
  edit_robots: "landing-seo",
  use_template_title: "landing-seo",
  use_template_description: "landing-seo",
  edit_body: "landing-body",
  edit_handle: "landing-general",
  mark_reviewed: "landing-standing",
}

// The page's name, address and facet, its text, and its search appearance folded under them
function LandingMain({ data }: { data: LandingDetail }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const update = useUpdateLanding(data.id)
  const findings = useSectionFindings({
    kind: "landing",
    id: data.id,
    version: data.updated_at,
    targets: TARGETS,
  })
  const seo = findings("landing-seo")
  return (
    <>
      <div id="landing-general" className="scroll-mt-20">
        <LandingGeneralCard landing={data} />
      </div>
      <div id="landing-body" className="scroll-mt-20">
        <DocumentCard
          title={t("content.body")}
          description={t("content.landing.bodyHint")}
          stored={data.body}
          saving={update.isPending}
          save={async (body) => {
            const { landing: saved } = await update.mutateAsync({ body })
            client.setQueryData(landingQuery(data.id).queryKey, saved)
          }}
        />
      </div>
      <SeoCard
        type="landing"
        id={data.id}
        context={{
          path: data.path ?? "",
          tokens: { başlık: data.title, kategori: data.category?.name ?? "" },
          fallbackDescription: excerpt(docText(data.body), DESCRIPTION_EXCERPT),
        }}
        collapse={{
          id: "landing-seo",
          name: "content.seo",
          note: findingsNote(t, seo),
          attention: seo.attention,
        }}
      />
    </>
  )
}

/**
 * A facet landing page (F3.16): its title and text first, its search
 * appearance folded under them; how much of it is its own and the SEO
 * advisor beside them, following the scroll.
 */
export function LandingEntryPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const landing = useQuery(landingQuery(id))
  if (landing.isError) {
    return <ErrorState text={errorText(t, landing.error)} onRetry={() => void landing.refetch()} />
  }
  if (!landing.data) {
    return <LoadingRows rows={8} />
  }
  const data = landing.data
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        back={{ to: "/content", search: { kind: "landing" }, label: t("content.tabs.landing") }}
        title={data.title}
        description={data.path ?? undefined}
        badge={<ContentStatusBadge status={data.status} />}
        action={<LandingActions landing={data} />}
      />
      <EditorLayout
        main={<LandingMain data={data} />}
        side={
          <>
            <div id="landing-standing" className="scroll-mt-20">
              <LandingStandingCard landing={data} />
            </div>
            <AdvisorCard
              kind="landing"
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
