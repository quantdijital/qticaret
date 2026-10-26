import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import type { Promotion } from "@/features/promotions/api/promotions"
import { offerKind, scheduleOf } from "@/features/promotions/offer"
import type { Scope } from "@/features/promotions/scope"
import { formatMoney } from "@/lib/format"

interface Method {
  type?: string | null
  target_type?: string | null
  value?: number | null
  currency_code?: string | null
}

/** "%10 sepette", "₺50 sepette" or "Ücretsiz kargo". */
export function OfferText({ method }: { method: Method | null | undefined }) {
  const { t } = useTranslation()
  const kind = offerKind(method)
  const value = method?.value ?? 0
  if (kind === "free_shipping") {
    return <span>{t("promotions.offer.free_shipping")}</span>
  }
  // Off some items, not the basket: the lines below say which
  const items = method?.target_type === "items"
  return (
    <span className="tabular-nums">
      {kind === "fixed"
        ? t(items ? "promotions.offer.fixedItems" : "promotions.offer.fixed", {
            amount: formatMoney(value, method?.currency_code ?? "try"),
          })
        : t(items ? "promotions.offer.percentageItems" : "promotions.offer.percentage", {
            value,
          })}
    </span>
  )
}

/** Where and when it applies, as lines under the offer: "Seçili 3 kategoride", "En az ₺150 sepette". */
export function ConditionLines({
  kind,
  scope,
  count,
  minimum,
  perCustomer,
}: {
  kind: string
  scope: Scope
  count: number
  minimum: number | null
  perCustomer: number | null
}) {
  const { t } = useTranslation()
  const lines = [
    ...(kind !== "free_shipping" && scope !== "all" && count > 0
      ? [t(`promotions.form.previewScope.${scope}`, { count })]
      : []),
    ...(minimum
      ? [t("promotions.form.previewMinimum", { amount: formatMoney(minimum, "try") })]
      : []),
    ...(perCustomer ? [t("promotions.form.previewPerCustomer", { count: perCustomer })] : []),
  ]
  return lines.length > 0 ? (
    <ul className="flex flex-col gap-0.5 text-[13px] text-muted-foreground">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  ) : null
}

const TONE: Record<ReturnType<typeof scheduleOf>, StatusTone> = {
  active: "success",
  scheduled: "info",
  draft: "neutral",
  ended: "neutral",
  inactive: "warning",
}

export function ScheduleBadge({ promotion }: { promotion: Promotion }) {
  const { t } = useTranslation()
  const schedule = scheduleOf(promotion.status ?? "draft", promotion.campaign)
  return <StatusBadge tone={TONE[schedule]}>{t(`promotions.schedule.${schedule}`)}</StatusBadge>
}
