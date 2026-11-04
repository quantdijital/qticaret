import { Link } from "@tanstack/react-router"
import { FileDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { evidenceUrl } from "@/features/orders/api/chargebacks"
import type { Chargeback, ChargebackStatus } from "@/features/orders/api/chargebacks"
import { formatDateTime, formatMoney } from "@/lib/format"

const C = "orders.chargeback"

const TONE: Record<ChargebackStatus, StatusTone> = {
  open: "danger",
  evidence_submitted: "warning",
  won: "success",
  lost: "neutral",
}

/**
 * The order's disputes (F6.7), closed ones too, in its secondary tabs: an
 * open one is also the alert at the top of the page. Its evidence in one
 * click; moving it on is the queue's.
 */
export function ChargebacksCard({ chargebacks }: { chargebacks: readonly Chargeback[] }) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={t(`${C}.orderTitle`)}
      action={
        <Button asChild size="sm" variant="outline">
          <Link to="/orders/chargebacks">{t(`${C}.queue`)}</Link>
        </Button>
      }
      flush
    >
      <ul className="flex flex-col">
        {chargebacks.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-5 py-3 text-sm"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {t(`${C}.reasons.${row.reason}`)}
                <StatusBadge tone={TONE[row.status]}>{t(`${C}.status.${row.status}`)}</StatusBadge>
              </span>
              <span className="text-xs text-muted-foreground">
                {[
                  formatDateTime(row.created_at),
                  row.due_at ? `${t(`${C}.due`)}: ${formatDateTime(row.due_at)}` : null,
                  row.provider_reference,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-medium tabular-nums">
                {formatMoney(row.amount, row.currency_code)}
              </span>
              <Button asChild size="sm" variant="ghost">
                <a href={evidenceUrl(row.id)} download>
                  <FileDown />
                  {t(`${C}.evidence`)}
                </a>
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
