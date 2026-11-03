import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { exclusionOf, returnRequestsQuery } from "@/features/orders/api/returns"
import type { ReturnStatus } from "@/features/orders/api/returns"
import { NonWithdrawableBadge } from "@/features/orders/components/non-withdrawable-badge"
import { ReturnActions } from "@/features/orders/components/return-actions"
import type { Open } from "@/features/orders/components/return-actions"
import { ReturnDialogHost } from "@/features/orders/components/return-dialog-host"
import { differenceText } from "@/features/orders/exchange-text"
import { formatDateTime, formatMoney } from "@/lib/format"

const R = "orders.returns"

const TONE: Record<ReturnStatus, StatusTone> = {
  requested: "warning",
  approved: "info",
  received: "info",
  refunded: "success",
  rejected: "neutral",
  canceled: "neutral",
}

/**
 * The order's returns and exchanges (F12.3) where the order is: each
 * request with the queue's own actions. Not shown while there is none; a
 * request for the shopper who called is opened from the order's actions.
 */
export function ReturnsCard({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const requests = useQuery(returnRequestsQuery({ order_id: orderId }))
  const [open, setOpen] = useState<Open>(null)
  const rows = requests.data?.return_requests ?? []
  if (rows.length === 0) {
    return null
  }
  const close = () => {
    setOpen(null)
  }
  return (
    <SectionCard title={t(`${R}.card.title`)} description={t(`${R}.card.text`)} flush>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3 text-sm"
          >
            <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {t(row.kind === "exchange" ? `${R}.open.exchange` : `${R}.open.return`)}
                <StatusBadge tone={TONE[row.status]}>{t(`${R}.status.${row.status}`)}</StatusBadge>
                {/* Such a line is taken back only as faulty or wrong: said before it is decided */}
                {exclusionOf(row) !== undefined ? (
                  <NonWithdrawableBadge reason={exclusionOf(row)} />
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {[t(`${R}.reasons.${row.reason}`), formatDateTime(row.created_at), row.return_code]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <span className="tabular text-sm">
              {row.refund_amount
                ? formatMoney(row.refund_amount, "try")
                : row.kind === "exchange"
                  ? differenceText(t, row.difference)
                  : null}
            </span>
            <ReturnActions request={row} onOpen={setOpen} />
          </li>
        ))}
      </ul>
      <ReturnDialogHost open={open} onClose={close} />
    </SectionCard>
  )
}
