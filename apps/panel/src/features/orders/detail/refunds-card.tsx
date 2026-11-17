import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { ShopRefund } from "@/features/orders/api/payments"
import { formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"

const TONES: Record<ShopRefund["status"], StatusTone> = {
  done: "success",
  pending: "info",
  failed: "danger",
}

/** The money given back on the order (F5 V5), newest last, with the shop's notes. */
export function RefundsCard({ refunds, currency }: { refunds: ShopRefund[]; currency: string }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t("orders.refunds.title")} flush>
      <ul className="flex flex-col">
        {refunds.map((refund) => (
          <li
            key={refund.reference}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-5 py-3"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium tabular-nums">
                {formatMoney(refund.amount, currency)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {[formatDateTime(refund.created_at), refund.note].filter(Boolean).join(" · ")}
              </span>
            </span>
            {refund.incomplete ? (
              <StatusBadge tone="warning">{t("orders.refunds.states.incomplete")}</StatusBadge>
            ) : (
              <StatusBadge tone={TONES[refund.status]}>
                {t(`orders.refunds.states.${refund.status}`)}
              </StatusBadge>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
