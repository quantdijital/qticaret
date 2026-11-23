import { useQuery } from "@tanstack/react-query"
import { CloudOff, FileText, Receipt } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qticaret/admin-ui/ui/table"
import { formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import { planPaymentsQuery } from "@/features/settings/api/plan"
import type { PaymentRecord } from "@/features/settings/api/plan"
import {
  paymentDayOf,
  paymentPeriodLabel,
  paymentStateOf,
} from "@/features/settings/subscription-rules"
import type { PaymentState } from "@/features/settings/subscription-rules"

const TONES: Record<PaymentState, StatusTone> = {
  paid: "success",
  waived: "neutral",
  open: "warning",
  late: "danger",
}

/** The rows shown before "Tümünü göster": half a year of monthly payments. */
export const PAYMENTS_SHOWN = 6

/** No rows: an icon and a few words, in the payment card's dashed box. */
function Blank({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="mx-5 mb-5 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-6 text-muted-foreground">
      <Icon className="size-6" aria-hidden="true" />
      <span className="text-[13px] font-medium">{text}</span>
    </div>
  )
}

function Row({ record, today }: { record: PaymentRecord; today: string }) {
  const { t } = useTranslation()
  const state = paymentStateOf(record, today)
  const day = formatDate(paymentDayOf(record))
  return (
    <TableRow>
      <TableCell className="pl-5">
        <span className="font-medium">{paymentPeriodLabel(record)}</span>
        {/* The day under the period on a phone, its own column from a tablet */}
        <span className="block text-[12px] text-muted-foreground tabular-nums sm:hidden">
          {day}
        </span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
        {day}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatMoney(record.amount / 100, record.currency)}
      </TableCell>
      <TableCell>
        <StatusBadge tone={TONES[state]}>{t(`plan.history.state.${state}`)}</StatusBadge>
      </TableCell>
      <TableCell className="pr-5 text-right">
        {record.invoice_url ? (
          <a
            href={record.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            aria-label={t("plan.history.invoiceOf", { period: paymentPeriodLabel(record) })}
          >
            <FileText className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("plan.history.invoice")}</span>
          </a>
        ) : (
          <span className="text-muted-foreground">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t("plan.history.noInvoice")}</span>
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}

/**
 * The shop's payments to the platform (adr/0061 Ek C20) under the package
 * and its use: each period, its day (paid, else due), amount, status and
 * the invoice when there is one, the latest first; six, then all on ask.
 * Signed by the control plane for this shop; when it cannot be read now,
 * the card says so and the page stands.
 */
export function PaymentsHistoryCard({ today }: { today: string }) {
  const { t } = useTranslation()
  const history = useQuery(planPaymentsQuery())
  const [all, setAll] = useState(false)
  const records = history.data?.state === "ok" ? history.data.records : []
  const shown = all ? records : records.slice(0, PAYMENTS_SHOWN)
  const more = records.length - shown.length
  return (
    <SectionCard
      title={t("plan.history.title")}
      flush
      action={
        more > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAll(true)
            }}
          >
            {t("plan.history.showAll", { count: records.length })}
          </Button>
        ) : null
      }
    >
      {history.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3 px-5 pb-5">
          <span className="sr-only">{t("plan.history.loading")}</span>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : history.isError || history.data.state !== "ok" ? (
        <Blank icon={CloudOff} text={t("plan.history.unavailable")} />
      ) : records.length === 0 ? (
        <Blank icon={Receipt} text={t("plan.history.empty")} />
      ) : (
        <Table aria-label={t("plan.history.title")}>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">{t("plan.history.period")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("plan.history.day")}</TableHead>
              <TableHead className="text-right">{t("plan.history.amount")}</TableHead>
              <TableHead>{t("plan.history.status")}</TableHead>
              <TableHead className="pr-5 text-right">{t("plan.history.invoice")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((record) => (
              <Row key={record.id} record={record} today={today} />
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
