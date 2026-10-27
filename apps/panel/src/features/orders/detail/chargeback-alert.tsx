import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { chargebacksQuery, evidenceUrl } from "@/features/orders/api/chargebacks"
import { formatDateTime } from "@/lib/format"

const C = "orders.chargeback"

/** An open dispute on the order (F6.7): its state, its deadline, the evidence in one click. */
export function ChargebackAlert({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const query = useQuery(chargebacksQuery({ order_id: orderId }))
  const open = query.data?.chargebacks.find(
    (chargeback) => chargeback.status === "open" || chargeback.status === "evidence_submitted"
  )
  if (!open) {
    return null
  }
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {open.due_at
            ? t(`${C}.alertDue`, {
                status: t(`${C}.status.${open.status}`),
                date: formatDateTime(open.due_at),
              })
            : t(`${C}.alert`, { status: t(`${C}.status.${open.status}`) })}
        </span>
        <span className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={evidenceUrl(open.id)} download>
              {t(`${C}.evidence`)}
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/orders/chargebacks">{t(`${C}.queue`)}</Link>
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  )
}
