import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { advisorSummaryQuery } from "@/features/seo/api/advisor"
import type { AdvisorSummary, Grade } from "@/features/seo/api/advisor"
import { ScoreRing } from "@/features/seo/advisor/score-ring"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const gradeOf = (score: number): Grade =>
  score >= 90 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "needs_work" : "poor"

function Score({ summary }: { summary: AdvisorSummary }) {
  const { t } = useTranslation()
  if (summary.products === 0 || summary.average === null) {
    return <p className="text-[13px] text-muted-foreground">{t("seo.advisor.noAssessments")}</p>
  }
  return (
    <div className="flex items-center gap-4">
      <ScoreRing
        score={summary.average}
        grade={gradeOf(summary.average)}
        size={64}
        label={t("seo.advisor.scoreLabel", { score: summary.average })}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-muted-foreground">
          {t("seo.advisor.assessed", {
            count: summary.products,
            products: formatCount(summary.products),
          })}
        </span>
        {summary.critical > 0 ? (
          <span className="flex items-start gap-1.5 text-[13px] text-warning-text">
            <TriangleAlert className="h-lh w-3.5 shrink-0" aria-hidden="true" />
            {t("seo.advisor.criticalCount", {
              count: summary.critical,
              products: formatCount(summary.critical),
            })}
          </span>
        ) : null}
        <Link
          to="/seo"
          className="mt-1 flex items-center gap-1 text-[13px] font-medium text-primary-text hover:underline"
        >
          {t("dashboard.seo.open")}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

/**
 * The shop's SEO score on the overview (F12.1, docs/14 §5): its products'
 * average, how many have a critical finding, and the way to the SEO page
 * that lists them.
 */
export function SeoScoreCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(advisorSummaryQuery())
  return (
    <SectionCard title={t("seo.advisor.shopScore")} className={className}>
      <AsyncBody query={query} skeleton={<Skeleton className="h-16 w-full" />}>
        {(summary) => <Score summary={summary} />}
      </AsyncBody>
    </SectionCard>
  )
}
