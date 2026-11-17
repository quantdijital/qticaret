import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { ShopRefund } from "@/features/orders/api/payments"
import { formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"
import { SettleRefundDialog } from "./settle-refund-dialog"

const TONES: Record<ShopRefund["status"], StatusTone> = {
  done: "success",
  pending: "info",
  failed: "danger",
}

function RefundRow({ refund, currency }: { refund: ShopRefund; currency: string }) {
  const { t } = useTranslation()
  return (
    <>
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
      ) : refund.made_in_part ? (
        <StatusBadge tone="success">{t("orders.refunds.states.made_in_part")}</StatusBadge>
      ) : (
        <StatusBadge tone={TONES[refund.status]}>
          {t(`orders.refunds.states.${refund.status}`)}
        </StatusBadge>
      )}
    </>
  )
}

const ROW = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-5 py-3"

/**
 * The money given back on the order (F5 V5), newest last, with the shop's
 * notes. A refund whose record stayed incomplete opens the shop's check
 * at the provider (review 2026-11-17, O2).
 */
export function RefundsCard({
  orderId,
  refunds,
  currency,
}: {
  orderId: string
  refunds: ShopRefund[]
  currency: string
}) {
  const { t } = useTranslation()
  const [checking, setChecking] = useState<ShopRefund | null>(null)
  return (
    <SectionCard title={t("orders.refunds.title")} flush>
      <ul className="flex flex-col">
        {refunds.map((refund) => (
          <li key={refund.reference}>
            {refund.incomplete ? (
              <button
                type="button"
                className={`${ROW} w-full text-left hover:bg-muted/50`}
                aria-label={t("orders.refunds.settle.open")}
                onClick={() => {
                  setChecking(refund)
                }}
              >
                <RefundRow refund={refund} currency={currency} />
              </button>
            ) : (
              <div className={ROW}>
                <RefundRow refund={refund} currency={currency} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <SettleRefundDialog
        orderId={orderId}
        refund={checking}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) {
            setChecking(null)
          }
        }}
      />
    </SectionCard>
  )
}
