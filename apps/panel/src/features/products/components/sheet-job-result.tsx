import { Link } from "@tanstack/react-router"
import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type { ImportSummary, SheetJob } from "@/features/products/api/sheets"
import { GRADE_TEXT } from "@/features/seo/advisor/grades"
import { JobDownloadButton } from "@/features/settings/components/job-download-button"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const GRADES = ["excellent", "good", "needs_work", "poor"] as const
// `P-IMG-01` → the panel's words for `IMG-01` (as the advisor card reads them)
const ruleText = (rule: string) => rule.slice(rule.indexOf("-") + 1)

function SeoPreview({ seo }: { seo: NonNullable<ImportSummary["seo"]> }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-[13px] font-medium">{t("products.sheets.seoTitle")}</p>
      <div className="flex flex-wrap gap-3 text-[13px]">
        {GRADES.map((grade) => (
          <span key={grade} className={cn("tabular-nums", GRADE_TEXT[grade])}>
            {t(`seo.advisor.grades.${grade}`)}: {formatCount(seo.grades[grade] ?? 0)}
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
        {seo.top.map((issue) => (
          <li key={issue.rule}>
            {t("products.sheets.seoIssue", {
              text: t(`seo.advisor.rules.${ruleText(issue.rule)}.title`, issue.params),
              count: issue.count,
            })}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Counts({ summary }: { summary: ImportSummary }) {
  const { t } = useTranslation()
  const done = summary.mode === "apply"
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <p className="flex items-start gap-2 font-medium">
        <CircleCheck className="h-lh w-4 shrink-0 text-success-text" aria-hidden="true" />
        {t(done ? "products.sheets.applied" : "products.sheets.planned", {
          create: formatCount(summary.create),
          update: formatCount(summary.update),
        })}
      </p>
      <p className="text-muted-foreground">
        {t("products.sheets.rows", { count: summary.rows, formatted: formatCount(summary.rows) })}
        {summary.unchanged > 0
          ? ` ${t("products.sheets.unchanged", { count: summary.unchanged, formatted: formatCount(summary.unchanged) })}`
          : ""}
      </p>
      {summary.problems + summary.failed > 0 ? (
        <p className="flex items-start gap-2 text-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {summary.problems > 0
            ? t("products.sheets.problems", { count: summary.problems })
            : ""}{" "}
          {summary.failed > 0 ? t("products.sheets.failedCount", { count: summary.failed }) : ""}
        </p>
      ) : null}
      {summary.limited ? (
        // adr/0061 Ek C14: new products past the package's limit, left out and in the report
        <p className="flex items-start gap-2 text-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t("products.sheets.limited", { count: summary.limited })}{" "}
            <Link to="/settings/subscription" className="font-medium underline">
              {t("plan.view")}
            </Link>
          </span>
        </p>
      ) : null}
      {summary.unknown_columns.length > 0 ? (
        <p className="text-muted-foreground">
          {t("products.sheets.unknownColumns", { columns: summary.unknown_columns.join(", ") })}
        </p>
      ) : null}
    </div>
  )
}

/** A check's or an import's progress, then what it found or did, and its report. */
export function SheetJobResult({ job }: { job: SheetJob }) {
  const { t } = useTranslation()
  if (job.status === "queued" || job.status === "running") {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("products.sheets.working")}
        </p>
        <Progress value={job.progress ?? 0} aria-label={t("products.sheets.working")} />
      </div>
    )
  }
  if (job.status !== "succeeded" || !job.result_summary) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {job.error_message ?? t("products.sheets.jobFailed")}
      </p>
    )
  }
  const summary = job.result_summary as unknown as ImportSummary
  return (
    <div className="flex flex-col gap-3">
      <Counts summary={summary} />
      {summary.seo && summary.seo.top.length > 0 ? <SeoPreview seo={summary.seo} /> : null}
      <div>
        <JobDownloadButton job={job} label={t("products.sheets.report")} />
      </div>
    </div>
  )
}
