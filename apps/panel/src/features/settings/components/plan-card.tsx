import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import type { PlanSummary } from "@/features/settings/api/plan"
import { packageName } from "@/features/settings/plan-rules"
import { isLate, periodLabel } from "@/features/settings/subscription-rules"
import type { PlanState } from "@/features/settings/subscription-rules"

const STATE_TONES: Record<PlanState, StatusTone> = {
  provisioning: "info",
  trialing: "info",
  active: "success",
  due_soon: "info",
  past_due: "warning",
  restricted: "danger",
  suspended: "danger",
  cancelled: "neutral",
  closing: "neutral",
  closed: "neutral",
}

/** The package's status as one badge (Settings > Abonelik and the tests read it). */
export function PlanStateBadge({ state }: { state: PlanState }) {
  const { t } = useTranslation()
  return <StatusBadge tone={STATE_TONES[state]}>{t(`plan.state.${state}`)}</StatusBadge>
}

/** Three facts side by side, split by thin lines (no card inside the card, docs/18 §3). */
function Facts({ rows }: { rows: { label: string; value: string; hint?: string | undefined }[] }) {
  return (
    <dl className="grid grid-cols-1 border-t sm:grid-cols-3 sm:divide-x max-sm:divide-y">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-col gap-1 py-4 sm:px-5 sm:first:pl-0">
          <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
          <dd className="text-[18px] leading-7 font-semibold tabular-nums">{row.value}</dd>
          {row.hint ? <dd className="text-[13px] text-muted-foreground">{row.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

/**
 * The package at the top of Settings > Abonelik: its name and one status
 * badge, then the next payment (or, in a trial, its end; late, the grace
 * day) and the month the monthly limits count. All from the signed plan
 * document (adr/0061 §5.6, Ek C16); nothing here is the shop's to change.
 */
export function PlanCard({ plan, state }: { plan: PlanSummary; state: PlanState }) {
  const { t } = useTranslation()
  const billing = plan.billing
  const name =
    plan.package_name ??
    (plan.package_code ? packageName(plan.package_code) : t("plan.package.none"))
  const late = isLate(state)
  const trial = state === "trialing"
  const dueValue = billing?.due_on ? formatDate(billing.due_on) : t("plan.facts.nothingDue")
  const amount =
    billing?.amount === null || billing?.amount === undefined
      ? "—"
      : formatMoney(billing.amount / 100, billing.currency)
  const third =
    late && billing?.grace_ends_on
      ? {
          label: t("plan.facts.graceEnds"),
          value: formatDate(billing.grace_ends_on),
          hint: t("plan.facts.graceHint"),
        }
      : {
          label: t("plan.facts.period"),
          value: periodLabel(plan.period),
          hint: t("plan.facts.periodHint"),
        }
  return (
    <SectionCard title={t("plan.package.title")}>
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-[22px] leading-8 font-semibold tracking-[-0.01em]">{name}</p>
          <PlanStateBadge state={state} />
        </div>
        <p className="-mt-3 text-[13px] text-muted-foreground">{t(`plan.stateText.${state}`)}</p>
        <div className="mt-auto">
          <Facts
            rows={[
              {
                label: t(
                  trial
                    ? "plan.facts.trialEnds"
                    : late
                      ? "plan.facts.lateDue"
                      : "plan.facts.nextDue"
                ),
                value: dueValue,
              },
              { label: t(trial ? "plan.facts.firstAmount" : "plan.facts.amount"), value: amount },
              third,
            ]}
          />
        </div>
      </div>
    </SectionCard>
  )
}

/**
 * How to pay, as the platform writes it (Ek C16), with a copy button for
 * the bank details; under it, how a package is changed. The payment
 * strip's "Ödeme bilgileri" leads here.
 */
export function PaymentCard({ plan }: { plan: PlanSummary }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const instruction = plan.payment_instruction
  const copy = () => {
    if (!instruction) {
      return
    }
    // Refused without the page's clipboard permission: the text stays selectable
    navigator.clipboard.writeText(instruction).then(
      () => {
        setCopied(true)
        toast.success(t("plan.payment.copied"))
      },
      () => toast.error(t("plan.payment.copyFailed"))
    )
  }
  return (
    <SectionCard
      title={t("plan.payment.title")}
      action={
        instruction ? (
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {t("plan.payment.copy")}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-1 flex-col gap-4 text-sm">
        {instruction ? (
          <p className="break-words whitespace-pre-line tabular-nums">{instruction}</p>
        ) : (
          <p className="text-muted-foreground">{t("plan.payment.none")}</p>
        )}
        <div className="mt-auto flex flex-col gap-1 border-t pt-4">
          <p className="font-medium">{t("plan.payment.changeTitle")}</p>
          <p className="text-[13px] text-muted-foreground">{t("plan.payment.changeText")}</p>
        </div>
      </div>
    </SectionCard>
  )
}
