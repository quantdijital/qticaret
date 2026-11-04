import { useQuery } from "@tanstack/react-query"
import { PackageOpen } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { EmptyRow } from "@/components/patterns/empty-row"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { returnLinesQuery, returnRequestsQuery } from "@/features/orders/api/returns"
import type { ReturnStatus } from "@/features/orders/api/returns"
import { ReturnActions } from "@/features/orders/components/return-actions"
import { ReturnFacts, RequestWithdrawalBadges } from "@/features/orders/components/return-facts"
import type { Open } from "@/features/orders/components/return-actions"
import { ReturnDialogHost } from "@/features/orders/components/return-dialog-host"
import { differenceText } from "@/features/orders/exchange-text"
import { formatDateTime, formatMoney } from "@/lib/format"
import { OpenReturnDialog } from "./open-return-dialog"
import { useReturnOpenable } from "./use-return-openable"

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
 * An order without a return or exchange (docs/06 "Detay sayfası düzeni"):
 * one row, not a card, with the way to open one for the shopper who called
 * while the shopper's own rules allow it (the order's menu offers it too).
 */
export function NoReturnsRow({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const { openable, returnable } = useReturnOpenable(orderId)
  const [opening, setOpening] = useState(false)
  return (
    <>
      <EmptyRow
        text={t(`${R}.card.none`)}
        action={
          openable ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOpening(true)
              }}
            >
              <PackageOpen />
              {t(`${R}.open.button`)}
            </Button>
          ) : null
        }
      />
      {opening && returnable ? (
        <OpenReturnDialog
          orderId={orderId}
          returnable={returnable}
          onClose={() => {
            setOpening(false)
          }}
        />
      ) : null}
    </>
  )
}

/**
 * The order's returns and exchanges (F12.3) where the order is: each
 * request with the queue's own actions. Not shown while there is none
 * (the page's tabs hold the "İade yok" row then).
 */
export function ReturnsCard({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const requests = useQuery(returnRequestsQuery({ order_id: orderId }))
  const [open, setOpen] = useState<Open>(null)
  const rows = requests.data?.return_requests ?? []
  // Refused units are named: the order's lines are read only then
  const lines = useQuery({
    ...returnLinesQuery(orderId),
    enabled: rows.some((row) => (row.refused_items ?? []).length > 0),
  })
  const titles = new Map((lines.data ?? []).map((line) => [line.id, line.title]))
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
                {/* Back only faulty, or refused if opened: said before it is decided */}
                <RequestWithdrawalBadges request={row} />
              </span>
              <span className="text-xs text-muted-foreground">
                {[
                  t(`${R}.reasons.${row.reason}`),
                  formatDateTime(row.created_at),
                  // A cancelled request's code was withdrawn at the carrier
                  row.status === "canceled" ? null : row.return_code,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <ReturnFacts request={row} titles={titles} />
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
