import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Alert, AlertAction, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { chargebacksQuery, evidenceUrl } from "@/features/orders/api/chargebacks"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

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
      <AlertDescription>
        {open.due_at
          ? t(`${C}.alertDue`, {
              status: t(`${C}.status.${open.status}`),
              date: formatDateTime(open.due_at),
            })
          : t(`${C}.alert`, { status: t(`${C}.status.${open.status}`) })}
      </AlertDescription>
      <AlertAction>
        <Button asChild size="sm" variant="outline">
          <a href={evidenceUrl(open.id)} download>
            {t(`${C}.evidence`)}
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/orders/chargebacks">{t(`${C}.queue`)}</Link>
        </Button>
      </AlertAction>
    </Alert>
  )
}
