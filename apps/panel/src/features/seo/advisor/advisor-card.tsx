import { useQuery } from "@tanstack/react-query"
import { ArrowDown, ChevronRight, Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { assessmentQuery, useApplyFix } from "@/features/seo/api/advisor"
import type { AdvisorKind, SeoIssue } from "@/features/seo/api/advisor"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { GRADE_TEXT, SEVERITY_TONES } from "./grades"
import { ScoreRing } from "./score-ring"
import { scrollToTarget } from "./scroll-to-target"

// Rule texts are shared by kind: "P-TITLE-01" and "C-TITLE-01" read the same
const textKey = (ruleId: string) => ruleId.slice(ruleId.indexOf("-") + 1)

interface IssueProps {
  issue: SeoIssue
  kind: AdvisorKind
  id: string
  /** Where each manual fix's field lives on this page (an element id). */
  targets: Readonly<Record<string, string>>
  /** Takes the person to a field's element; by default it is scrolled to. */
  onTarget: (target: string) => void
}

function Issue({ issue, kind, id, targets, onTarget }: IssueProps) {
  const { t } = useTranslation()
  const apply = useApplyFix(kind, id)
  const key = `seo.advisor.rules.${textKey(issue.ruleId)}`
  const target = issue.fix ? targets[issue.fix.action] : undefined
  const params = Object.fromEntries(
    Object.entries(issue.params).map(([name, value]) => [
      name,
      name === "missing"
        ? String(value)
            .split(",")
            .map((place) => t(`seo.advisor.places.${place}`))
            .join(", ")
        : name === "problem"
          ? t(`seo.advisor.problems.${String(value)}`)
          : value,
    ])
  )
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-2.5">
        <StatusBadge tone={SEVERITY_TONES[issue.severity]}>
          {t(`seo.advisor.severities.${issue.severity}`)}
        </StatusBadge>
        <span className="min-w-0 flex-1 text-[13px] leading-5">{t(`${key}.title`, params)}</span>
      </div>
      <details className="group pl-1 text-[13px] text-muted-foreground">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs hover:text-foreground">
          <ChevronRight
            className="size-3.5 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          {t("seo.advisor.why")}
        </summary>
        <p className="mt-1.5 leading-5">{t(`${key}.why`, params)}</p>
        <p className="mt-1 leading-5">{t(`${key}.how`, params)}</p>
      </details>
      {issue.fix?.kind === "auto" ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 self-start text-xs"
          disabled={apply.isPending}
          onClick={() => {
            apply.mutate(issue.fix?.action ?? "", {
              onSuccess: () => toast.success(t("seo.advisor.fixed")),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          {apply.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {t(`seo.advisor.fixes.${issue.fix.action}`)}
        </Button>
      ) : target ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 self-start text-xs"
          onClick={() => {
            onTarget(target)
          }}
        >
          <ArrowDown />
          {t("seo.advisor.goToField")}
        </Button>
      ) : null}
    </li>
  )
}

/**
 * The SEO advisor on a page (docs/14 §5): the score and its grade, the
 * findings most severe first with why they matter and how to fix them,
 * a one-click fix where one exists, else a way to the field.
 */
export function AdvisorCard({
  kind,
  id,
  version,
  targets = {},
  onTarget = scrollToTarget,
  className,
}: {
  kind: AdvisorKind
  id: string
  /** The page's last change: a save asks for a fresh assessment. */
  version?: string | null
  targets?: Readonly<Record<string, string>>
  /** A page whose fields sit in tabs opens the field's tab first (a product's SEO). */
  onTarget?: (target: string) => void
  className?: string
}) {
  const { t } = useTranslation()
  const query = useQuery(assessmentQuery(kind, id, version))
  const data = query.data
  return (
    <SectionCard
      title={t("seo.advisor.title")}
      description={t("seo.advisor.cardHint")}
      className={className}
    >
      {!data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <ScoreRing
              score={data.score}
              grade={data.grade}
              label={t("seo.advisor.scoreLabel", { score: data.score })}
            />
            <div className="flex flex-col gap-0.5">
              <span className={cn("text-sm font-semibold", GRADE_TEXT[data.grade])}>
                {t(`seo.advisor.grades.${data.grade}`)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {data.issues.length > 0
                  ? t("seo.advisor.issueCount", { count: data.issues.length })
                  : t("seo.advisor.noIssues")}
              </span>
            </div>
          </div>
          {data.issues.length > 0 ? (
            <ul className="flex flex-col divide-y">
              {data.issues.map((issue) => (
                <Issue
                  key={`${issue.ruleId}-${JSON.stringify(issue.params)}`}
                  issue={issue}
                  kind={kind}
                  id={id}
                  targets={targets}
                  onTarget={onTarget}
                />
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
