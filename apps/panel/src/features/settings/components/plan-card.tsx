import { CalendarDays, CalendarRange, CircleCheck, Hourglass, Package } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { PlanSummary } from "@/features/settings/api/plan"
import { packageName } from "@/features/settings/plan-rules"
import { DaysRing } from "@/features/settings/components/days-ring"
import type { RingTone } from "@/features/settings/components/days-ring"
import { isLate, periodLabel, ringShare } from "@/features/settings/subscription-rules"
import type { Countdown, PlanState } from "@/features/settings/subscription-rules"

const STATE_TONES: Record<PlanState, StatusTone> = {
  provisioning: "info",
  trialing: "info",
  active: "success",
  due_soon: "warning",
  past_due: "danger",
  restricted: "danger",
  suspended: "danger",
  cancelled: "neutral",
  closing: "neutral",
  closed: "neutral",
}

/** The card's left edge: red while a payment is late, amber in its last days. */
const ACCENT: Partial<Record<PlanState, string>> = {
  due_soon: "before:bg-warning",
  past_due: "before:bg-destructive",
  restricted: "before:bg-destructive",
  suspended: "before:bg-destructive",
}

/** The package's status as one badge (Settings > Abonelik and the tests read it). */
export function PlanStateBadge({ state }: { state: PlanState }) {
  const { t } = useTranslation()
  return <StatusBadge tone={STATE_TONES[state]}>{t(`plan.state.${state}`)}</StatusBadge>
}

/** A date or a countdown as a small pill with its icon. */
function Chip({
  icon: Icon,
  tone = "neutral",
  label,
  children,
}: {
  icon: LucideIcon
  tone?: "neutral" | "warning" | "danger"
  label?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium whitespace-nowrap tabular-nums",
        tone === "neutral" && "bg-background",
        tone === "warning" && "border-transparent bg-warning-soft text-warning-text",
        tone === "danger" && "border-transparent bg-destructive-soft text-destructive-text"
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label ? <span className="sr-only">{label}: </span> : null}
      {children}
    </span>
  )
}

const ringToneOf = (countdown: Countdown): RingTone =>
  countdown.kind === "grace" || countdown.kind === "overdue"
    ? "danger"
    : countdown.kind === "trial"
      ? "info"
      : countdown.days <= 3
        ? "warning"
        : "success"

/**
 * The package at the top of Settings > Abonelik (adr/0061 §5.6, Ek C16):
 * its name and one status, the amount due large with its day and a
 * countdown, the ring counting the same days, the month the monthly
 * limits count. The status's meaning sits behind the (i).
 */
export function PlanCard({
  plan,
  state,
  countdown,
}: {
  plan: PlanSummary
  state: PlanState
  countdown: Countdown | null
}) {
  const { t } = useTranslation()
  const hintId = useId()
  const billing = plan.billing
  const name =
    plan.package_name ??
    (plan.package_code ? packageName(plan.package_code) : t("plan.package.none"))
  const late = isLate(state)
  const which = late ? "late" : state === "trialing" ? "trial" : "due"
  const due = billing?.due_on ?? null
  const amount =
    billing?.amount === null || billing?.amount === undefined
      ? null
      : formatMoney(billing.amount / 100, billing.currency)
  const countdownText = countdown
    ? countdown.days === 0 && countdown.kind !== "overdue"
      ? t("plan.hero.countdown.today")
      : t(`plan.hero.countdown.${countdown.kind}`, { count: countdown.days })
    : null
  const accent = ACCENT[state]
  return (
    <section
      aria-label={t("plan.package.label")}
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-card",
        accent && "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        accent
      )}
    >
      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Package className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("plan.package.label")}
              </span>
              <h2 className="truncate text-[24px] leading-8 font-semibold tracking-[-0.02em]">
                {name}
              </h2>
            </div>
          </div>
          <span className="flex items-center gap-1.5">
            <PlanStateBadge state={state} />
            <InfoTip
              name={t(`plan.state.${state}`)}
              hint={t(`plan.stateText.${state}`)}
              hintId={hintId}
            />
            <HiddenHint id={hintId}>{t(`plan.stateText.${state}`)}</HiddenHint>
          </span>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-5">
          {due ? (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-muted-foreground">
                  {t(`plan.hero.amount.${which}`)}
                </span>
                <span className="text-[32px] leading-10 font-semibold tracking-[-0.02em] tabular-nums sm:text-[36px] sm:leading-11">
                  {amount ?? "—"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip icon={CalendarDays} label={t(`plan.hero.date.${which}`)}>
                  {formatDate(due)}
                </Chip>
                {countdownText && countdown ? (
                  <Chip
                    icon={Hourglass}
                    tone={
                      countdown.kind === "grace" || countdown.kind === "overdue"
                        ? "danger"
                        : countdown.days <= 3
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {countdownText}
                  </Chip>
                ) : null}
                {late && billing?.grace_ends_on ? (
                  <Chip icon={CalendarDays} tone="danger" label={t("plan.hero.graceEnds")}>
                    {formatDate(billing.grace_ends_on)}
                  </Chip>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[15px] font-medium text-muted-foreground">
              <CircleCheck className="size-5 text-success" aria-hidden="true" />
              {t("plan.hero.nothingDue")}
            </div>
          )}
          {countdown && countdownText ? (
            <DaysRing
              days={countdown.days}
              unit={t("plan.hero.ring.day")}
              caption={t(`plan.hero.ring.${countdown.kind}`)}
              share={ringShare(countdown)}
              tone={ringToneOf(countdown)}
              label={countdownText}
            />
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-3 text-[13px] sm:px-6">
        <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">{t("plan.hero.period")}</span>
        <span className="font-medium">{periodLabel(plan.period)}</span>
        <InfoTip name={t("plan.hero.period")} hint={t("plan.hero.periodHint")} />
      </div>
    </section>
  )
}
