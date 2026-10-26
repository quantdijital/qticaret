import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { landingQuery, useUpdateLanding } from "@/features/content/api/landings"
import type { LandingDetail } from "@/features/content/api/landings"
import { ContentStatusBadge } from "@/features/content/components/content-status"
import { DocumentCard } from "@/features/content/components/document-card"
import { LandingActions } from "@/features/content/components/landing-actions"
import { LandingGeneralCard } from "@/features/content/components/landing-general-card"
import { LandingStandingCard } from "@/features/content/components/landing-standing-card"
import { docText } from "@/features/content/doc-text"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/content/landings/$id")

const TARGETS = {
  edit_title: "landing-seo",
  edit_description: "landing-seo",
  edit_robots: "landing-seo",
  edit_body: "landing-body",
  edit_handle: "landing-general",
  mark_reviewed: "landing-standing",
}

// The page's name, address and facet, its text and its search appearance
function LandingMain({ data }: { data: LandingDetail }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const update = useUpdateLanding(data.id)
  return (
    <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-8">
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
      <div id="landing-seo" className="scroll-mt-20">
        <SeoCard
          type="landing"
          id={data.id}
          context={{
            path: data.path ?? "",
            tokens: { başlık: data.title, kategori: data.category?.name ?? "" },
            fallbackDescription: excerpt(docText(data.body), DESCRIPTION_EXCERPT),
          }}
        />
      </div>
    </div>
  )
}

/** A facet landing page (F3.16): its text, how much of it is its own, its search appearance. */
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
      <div className="grid grid-cols-1 items-start gap-[var(--grid-gap)] xl:grid-cols-12">
        <LandingMain data={data} />
        <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-4">
          <AdvisorCard kind="landing" id={data.id} version={data.updated_at} targets={TARGETS} />
          <div id="landing-standing" className="scroll-mt-20">
            <LandingStandingCard landing={data} />
          </div>
        </div>
      </div>
    </div>
  )
}
