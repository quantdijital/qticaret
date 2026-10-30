import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { advisorSummaryQuery } from "@/features/seo/api/advisor"
import type { Grade } from "@/features/seo/api/advisor"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import { GRADE_TEXT } from "./grades"
import { ScoreRing } from "./score-ring"
import { errorText } from "@/lib/errors"

const GRADES: Grade[] = ["excellent", "good", "needs_work", "poor"]

// The same status colours as the score ring; every segment is named in the legend
const SEGMENT: Record<Grade, string> = {
  excellent: "bg-success",
  good: "bg-info",
  needs_work: "bg-warning",
  poor: "bg-destructive",
}

/**
 * The shop's SEO picture (docs/14 §5): its average product score, how the
 * products spread over the grades, how many have a critical finding, and
 * the ten that need the most work, one click from their page.
 */
export function AdvisorSummaryCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const summary = useQuery(advisorSummaryQuery())
  const data = summary.data
  return (
    <SectionCard
      title={t("seo.advisor.title")}
      description={t("seo.advisor.summaryHint")}
      className={className}
    >
      {summary.isError ? (
        <ErrorState text={errorText(t, summary.error)} onRetry={() => void summary.refetch()} />
      ) : !data ? (
        <Skeleton className="h-48" />
      ) : data.products === 0 || data.average === null ? (
        <p className="text-[13px] text-muted-foreground">{t("seo.advisor.noAssessments")}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <ScoreRing
                score={data.average}
                grade={
                  data.average >= 90
                    ? "excellent"
                    : data.average >= 70
                      ? "good"
                      : data.average >= 50
                        ? "needs_work"
                        : "poor"
                }
                size={84}
                label={t("seo.advisor.scoreLabel", { score: data.average })}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{t("seo.advisor.shopScore")}</span>
                <span className="text-[13px] text-muted-foreground">
                  {t("seo.advisor.assessed", {
                    count: data.products,
                    products: formatCount(data.products),
                  })}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={GRADES.map(
                  (grade) => `${t(`seo.advisor.grades.${grade}`)}: ${String(data.grades[grade])}`
                ).join(", ")}
              >
                {GRADES.filter((grade) => data.grades[grade] > 0).map((grade) => (
                  <span
                    key={grade}
                    className={cn("h-full", SEGMENT[grade])}
                    style={{ width: `${String((data.grades[grade] / data.products) * 100)}%` }}
                  />
                ))}
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {GRADES.map((grade) => (
                  <li key={grade} className="flex items-center gap-1.5">
                    <span
                      className={cn("size-2 rounded-full", SEGMENT[grade])}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">
                      {t(`seo.advisor.grades.${grade}`)}
                    </span>
                    <span className="ml-auto tabular-nums">{formatCount(data.grades[grade])}</span>
                  </li>
                ))}
              </ul>
            </div>
            {data.critical > 0 ? (
              <p className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2 text-[13px] text-destructive-text">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t("seo.advisor.criticalCount", {
                  count: data.critical,
                  products: formatCount(data.critical),
                })}
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("seo.advisor.lowest")}
            </span>
            {/* Two columns on a wide card, so the list is about as tall as the score beside it */}
            <ul className="grid overflow-hidden rounded-md border sm:grid-cols-2 [&>li]:-mb-px [&>li]:border-b sm:[&>li:nth-child(odd)]:border-r">
              {data.lowest.map((product) => (
                <li key={product.id}>
                  <Link
                    to="/products/$id"
                    params={{ id: product.id }}
                    className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <ProductThumb src={product.thumbnail} className="size-8" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{product.title}</span>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        GRADE_TEXT[product.grade]
                      )}
                    >
                      {product.score}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
