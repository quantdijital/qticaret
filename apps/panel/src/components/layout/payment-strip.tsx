import { Link } from "@tanstack/react-router"
import { CalendarClock, CircleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { dayOf } from "@qticaret/admin-ui/lib/days"
import { formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { usePlan } from "@/features/settings/api/plan"
import { paymentStrip } from "@/features/settings/plan-rules"

/**
 * The payment strip (adr/0061 §5.5 "ek sürede sahip ve yöneticiye ödeme
 * şeridi", Ek C16): while the shop is active, for the owner and admins
 * only (who may read the plan; for the others `usePlan` is undefined), in
 * the last days before a payment is due and through its grace, with the
 * day the panel would be restricted. Its facts come from the signed plan
 * document; the shop's own settings never set them.
 */
export function PaymentStrip({ id }: { id: string }) {
  const { t } = useTranslation()
  const plan = usePlan()
  const billing = plan?.billing ?? null
  const kind = plan?.managed ? paymentStrip(billing, dayOf(new Date())) : null
  if (!kind || !billing?.due_on) {
    return null
  }
  const values = {
    date: formatDate(billing.due_on),
    graceEnds: billing.grace_ends_on ? formatDate(billing.grace_ends_on) : "",
    amount: billing.amount === null ? "" : formatMoney(billing.amount / 100, billing.currency),
  }
  const late = kind === "late"
  const Icon = late ? CircleAlert : CalendarClock
  return (
    <div
      id={id}
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-[13px] lg:px-[var(--page-padding-wide)]",
        late
          ? "border-warning bg-warning-soft text-warning-text"
          : "border-info bg-info-soft text-info-text"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium">
        {late && billing.grace_ends_on
          ? t("plan.strip.late", values)
          : t(late ? "plan.strip.lateNoDate" : "plan.strip.soon", values)}
      </span>
      <Link to="/settings/subscription" className="font-medium underline underline-offset-4">
        {t("plan.strip.howToPay")}
      </Link>
    </div>
  )
}
