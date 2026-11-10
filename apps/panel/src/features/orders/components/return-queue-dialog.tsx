import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { ReturnActions } from "@/features/orders/components/return-actions"
import type { Open } from "@/features/orders/components/return-actions"
import { ReturnFacts, RequestWithdrawalBadges } from "@/features/orders/components/return-facts"
import { Fact, QueueDialog } from "@/features/orders/components/queue-dialog"
import { differenceText } from "@/features/orders/exchange-text"
import { RETURN_TONE } from "@/features/orders/return-rules"
import { formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"

const R = "orders.returns"

/**
 * A return or exchange request opened from the queue: where it stands, why,
 * what the law asks of it, its money, and the queue's own actions for it;
 * an action's own dialog takes its place.
 */
export function ReturnQueueDialog({
  request,
  onClose,
  onOpen,
}: {
  request: ReturnRequest | null
  onClose: () => void
  onOpen: (open: Open) => void
}) {
  const { t } = useTranslation()
  return (
    <QueueDialog
      open={request !== null}
      onClose={onClose}
      title={t(`${R}.dialogTitle`, { number: request?.order_display_id ?? "—" })}
      description={
        request ? t(request.kind === "exchange" ? `${R}.open.exchange` : `${R}.open.return`) : null
      }
      orderId={request?.order_id ?? null}
    >
      {request ? (
        <div className="flex flex-col gap-4">
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={RETURN_TONE[request.status]}>
              {t(`${R}.status.${request.status}`)}
            </StatusBadge>
            <RequestWithdrawalBadges request={request} />
          </span>
          <dl>
            <Fact label={t(`${R}.columns.reason`)}>{t(`${R}.reasons.${request.reason}`)}</Fact>
            <Fact label={t(`${R}.columns.date`)}>{formatDateTime(request.created_at)}</Fact>
            <Fact label={t(`${R}.columns.code`)}>{request.return_code ?? "—"}</Fact>
            <Fact label={t(`${R}.columns.refund`)}>
              {request.refund_amount
                ? formatMoney(request.refund_amount, "try")
                : request.kind === "exchange"
                  ? differenceText(t, request.difference)
                  : "—"}
            </Fact>
          </dl>
          <ReturnFacts request={request} />
          <div className="flex justify-end">
            <ReturnActions
              request={request}
              onOpen={(next) => {
                onClose()
                onOpen(next)
              }}
            />
          </div>
        </div>
      ) : null}
    </QueueDialog>
  )
}
