import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { formatCount, formatPercent } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { LimitStanding, PlanSummary } from "@/features/settings/api/plan"
import { ratioOf, toneOf } from "@/features/settings/plan-rules"
import type { UseTone } from "@/features/settings/plan-rules"
import { limitGroups, periodLabel, storageText } from "@/features/settings/subscription-rules"

const TONES: Record<UseTone, StatusTone> = {
  ok: "neutral",
  warn: "warning",
  full: "danger",
  over: "warning",
}

// The bar's colour follows its tone; the badge beside it says the same in words
const BAR: Record<UseTone, string> = {
  ok: "",
  warn: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
  full: "bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive",
  over: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
}

/** A count as the page writes it: storage in MB or GB, the rest as numbers. */
const amountOf = (standing: LimitStanding, value: number): string =>
  standing.unit === "mb" ? storageText(value) : formatCount(value)

/** The line under a meter: how much is left, by how much it is over, what is counted with it. */
function noteOf(t: TFunction, standing: LimitStanding, tone: UseTone): string[] {
  const { used, max } = standing
  const notes: string[] = []
  if (used !== null && max !== null) {
    if (tone === "over") {
      notes.push(t("plan.usage.over", { value: amountOf(standing, used - max) }))
    } else if (tone !== "full") {
      notes.push(t("plan.usage.left", { value: amountOf(standing, max - used) }))
    }
  }
  if (standing.kind === "warn") {
    notes.push(t("plan.usage.ordersNote"))
  }
  if (standing.pending) {
    notes.push(t("plan.usage.pending", { count: standing.pending }))
  }
  return notes
}

function Meter({ standing }: { standing: LimitStanding }) {
  const { t } = useTranslation()
  const name = t(`plan.keys.${standing.key}`)
  const tone = toneOf(standing)
  const ratio = ratioOf(standing)
  const used = amountOf(standing, standing.used ?? 0)
  const amount =
    standing.max === null
      ? t("plan.usage.unlimited", { used })
      : t("plan.usage.of", { used, max: amountOf(standing, standing.max) })
  const notes = noteOf(t, standing, tone)
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 font-medium">
          <span>{name}</span>
          {tone === "ok" ? null : (
            <StatusBadge tone={TONES[tone]}>{t(`plan.usage.tone.${tone}`)}</StatusBadge>
          )}
        </span>
        <span className="text-sm font-medium tabular-nums">{amount}</span>
      </div>
      {ratio === null ? null : (
        <Progress
          value={Math.round(ratio * 100)}
          aria-label={t("plan.usage.barLabel", { name, value: formatPercent(ratio) })}
          className={cn("h-1.5", BAR[tone])}
        />
      )}
      {notes.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">{notes.join(" · ")}</p>
      ) : null}
    </li>
  )
}

function Group({ title, hint, limits }: { title: string; hint: string; limits: LimitStanding[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-[13px] text-muted-foreground">{hint}</p>
      </div>
      <ul aria-label={title} className="flex flex-col gap-5">
        {limits.map((standing) => (
          <Meter key={standing.key} standing={standing} />
        ))}
      </ul>
    </div>
  )
}

/**
 * Each limit with its use (adr/0061 §5.3, §5.6), in two groups: the
 * shop's totals and this month's counts. Amber from 80 %, red at a limit
 * that stops new records; the month's orders only warn.
 */
export function UsageCard({ plan }: { plan: PlanSummary }) {
  const { t } = useTranslation()
  const { totals, monthly } = limitGroups(plan.limits)
  const groups = [
    totals.length > 0
      ? {
          key: "totals",
          title: t("plan.usage.totals"),
          hint: t("plan.usage.totalsHint"),
          limits: totals,
        }
      : null,
    monthly.length > 0
      ? {
          key: "monthly",
          title: t("plan.usage.monthly", { period: periodLabel(plan.period) }),
          hint: t("plan.usage.monthlyHint"),
          limits: monthly,
        }
      : null,
  ].filter((group) => group !== null)
  return (
    <SectionCard
      title={t("plan.usage.title")}
      description={plan.managed ? t("plan.usage.text") : t("plan.unmanaged")}
    >
      <div
        className={cn("grid grid-cols-1 gap-x-12 gap-y-8", groups.length > 1 && "md:grid-cols-2")}
      >
        {groups.map((group) => (
          <Group key={group.key} title={group.title} hint={group.hint} limits={group.limits} />
        ))}
      </div>
    </SectionCard>
  )
}
