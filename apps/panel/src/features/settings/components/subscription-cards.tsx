import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { formatCount, formatDate, formatMoney, formatPercent } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { BillingSummary, LimitStanding, PlanSummary } from "@/features/settings/api/plan"
import { packageName, ratioOf, shownLimits, toneOf } from "@/features/settings/plan-rules"
import type { UseTone } from "@/features/settings/plan-rules"

const TONES: Record<UseTone, StatusTone> = {
  ok: "neutral",
  warn: "warning",
  full: "danger",
  over: "warning",
}

// The bar's colour follows its tone; the words beside it say the same
const BAR: Record<UseTone, string> = {
  ok: "",
  warn: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
  full: "bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive",
  over: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
}

const BILLING_TONES: Record<BillingSummary["status"], StatusTone> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  restricted: "danger",
  cancelled: "neutral",
}

/** A count as the page writes it: megabytes with their unit. */
const amountOf = (t: TFunction, standing: LimitStanding, value: number): string =>
  standing.unit === "mb" ? t("plan.mb", { value: formatCount(value) }) : formatCount(value)

function UseLine({ standing }: { standing: LimitStanding }) {
  const { t } = useTranslation()
  const name = t(`plan.keys.${standing.key}`)
  const tone = toneOf(standing)
  const ratio = ratioOf(standing)
  const used = amountOf(t, standing, standing.used ?? 0)
  const amount =
    standing.max === null
      ? t("plan.usage.unlimited", { used })
      : t("plan.usage.of", { used, max: amountOf(t, standing, standing.max) })
  const notes = [
    standing.kind === "warn" ? t("plan.usage.ordersNote") : null,
    standing.pending ? t("plan.usage.pending", { count: standing.pending }) : null,
  ].filter((note): note is string => note !== null)
  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{name}</span>
        <span className="flex items-center gap-2">
          {tone === "ok" ? null : (
            <StatusBadge tone={TONES[tone]}>{t(`plan.usage.tone.${tone}`)}</StatusBadge>
          )}
          <span className="text-sm tabular-nums text-muted-foreground">{amount}</span>
        </span>
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

/** Each limit with its use (adr/0061 §5.6): amber from 80 %, red at a limit that blocks. */
export function UsageCard({ plan, className }: { plan: PlanSummary; className?: string }) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={t("plan.usage.title")}
      description={plan.managed ? t("plan.usage.text") : t("plan.unmanaged")}
      className={className}
    >
      <ul aria-label={t("plan.usage.listLabel")} className="flex flex-col divide-y">
        {shownLimits(plan.limits).map((standing) => (
          <UseLine key={standing.key} standing={standing} />
        ))}
      </ul>
    </SectionCard>
  )
}

/** Short facts as label and value rows. */
function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The package, the shop's status and the period the monthly limits count. */
export function PackageCard({ plan }: { plan: PlanSummary }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t("plan.package.title")} description={t("plan.package.text")}>
      <Facts
        rows={[
          [
            t("plan.package.name"),
            plan.package_name ??
              (plan.package_code ? packageName(plan.package_code) : t("plan.package.none")),
          ],
          [t("plan.package.status"), t(`plan.statuses.${plan.status}`, plan.status)],
          [t("plan.package.period"), plan.period],
        ]}
      />
    </SectionCard>
  )
}

/** Payment status, the next payment day and amount, and how to pay (signed, Ek C16). */
export function BillingCard({ plan }: { plan: PlanSummary }) {
  const { t } = useTranslation()
  const billing = plan.billing
  const none = t("plan.billing.none")
  const rows: [string, React.ReactNode][] = [
    [
      t("plan.billing.status"),
      billing ? (
        <StatusBadge tone={BILLING_TONES[billing.status]}>
          {t(`plan.billing.statuses.${billing.status}`)}
        </StatusBadge>
      ) : (
        none
      ),
    ],
    [t("plan.billing.nextDue"), billing?.due_on ? formatDate(billing.due_on) : none],
    [
      t("plan.billing.amount"),
      billing?.amount === null || billing?.amount === undefined
        ? none
        : formatMoney(billing.amount / 100, billing.currency),
    ],
  ]
  if (billing?.grace_ends_on) {
    rows.push([t("plan.billing.graceEnds"), formatDate(billing.grace_ends_on)])
  }
  return (
    <SectionCard title={t("plan.billing.title")} description={t("plan.billing.text")}>
      <div className="flex flex-1 flex-col gap-4">
        <Facts rows={rows} />
        <div className="mt-auto flex flex-col gap-1 border-t pt-4 text-sm">
          <p className="font-medium">{t("plan.billing.instruction")}</p>
          <p className="whitespace-pre-line text-muted-foreground">
            {plan.payment_instruction ?? t("plan.billing.noInstruction")}
          </p>
        </div>
      </div>
    </SectionCard>
  )
}
