import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { advisorSummaryQuery } from "@/features/seo/api/advisor"
import type { Grade } from "@/features/seo/api/advisor"
import { ScoreRing } from "@/features/seo/advisor/score-ring"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const gradeOf = (score: number): Grade =>
  score >= 90 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "needs_work" : "poor"

/**
 * The shop's SEO score in Settings > SEO's header, so the day's work shows
 * on arrival: the products' average and how many have a critical finding,
 * one click from the suggestions. Nothing until a product is assessed.
 */
export function SeoHomeSummary() {
  const { t } = useTranslation()
  const summary = useQuery(advisorSummaryQuery())
  const data = summary.data
  if (!data || data.products === 0 || data.average === null) {
    return null
  }
  return (
    <Link
      to="/settings/seo"
      search={{ part: "advisor" }}
      className="flex items-center gap-3 rounded-lg border bg-card py-2 pr-4 pl-2 transition-colors hover:bg-muted/50"
    >
      <ScoreRing
        score={data.average}
        grade={gradeOf(data.average)}
        size={40}
        label={t("seo.advisor.scoreLabel", { score: data.average })}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium">{t("seo.advisor.shopScore")}</span>
        <span
          className={cn(
            "text-xs",
            data.critical > 0 ? "text-warning-text" : "text-muted-foreground"
          )}
        >
          {data.critical > 0
            ? t("settings.seo.summary.critical", {
                count: data.critical,
                products: formatCount(data.critical),
              })
            : t("settings.seo.summary.clean")}
        </span>
      </span>
    </Link>
  )
}
