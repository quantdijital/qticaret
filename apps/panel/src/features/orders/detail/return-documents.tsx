import { FilePen, FileSearch, Ban } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { StatusTone } from "@/components/patterns/status-badge"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WAIVER_REASONS, useWaiveReturnDocument } from "@/features/orders/api/invoices"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { InvoiceDraftDialog } from "@/features/orders/detail/invoice-draft-dialog"
import { ReturnDocumentDialog } from "@/features/orders/detail/return-document-dialog"
import { errorText } from "@/lib/errors"
import { formatMoney } from "@/lib/format"

const R = "orders.invoice.returns"

const TONES: Readonly<Record<InvoiceRecord["status"], StatusTone>> = {
  pending: "warning",
  issuing: "info",
  issued: "success",
  failed: "danger",
  cancelled: "neutral",
  waived: "neutral",
}

/** One return's document: what it is, where it stands, and what staff do next. */
function ReturnRow({
  record,
  mayOpen,
  orderNumber,
}: {
  record: InvoiceRecord
  mayOpen: boolean
  orderNumber: number | null
}) {
  const { t } = useTranslation()
  const waive = useWaiveReturnDocument()
  const [open, setOpen] = useState<"draft" | "enter" | null>(null)
  const close = useCallback(() => {
    setOpen(null)
  }, [])
  const document = record.document_type === "return_invoice" ? "return_invoice" : "expense_voucher"
  const pending = record.status === "pending"
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{t(`${R}.kinds.${document}`)}</span>
        <StatusBadge tone={TONES[record.status]}>
          {record.status === "waived"
            ? t(`${R}.waived.${record.waived_reason ?? "payment_institution"}`)
            : t(`orders.invoice.status.${record.status}`)}
        </StatusBadge>
      </div>
      <p className="text-[13px] text-muted-foreground tabular-nums">
        {record.number
          ? t(`${R}.numbered`, { number: record.number, total: formatMoney(record.total, "try") })
          : t(`${R}.waiting.${document}`, { total: formatMoney(record.total, "try") })}
      </p>
      {mayOpen && (pending || (record.status === "issued" && !record.has_pdf)) ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {pending ? (
            <Button
              variant="outline"
              onClick={() => {
                setOpen("draft")
              }}
            >
              <FileSearch />
              {t("orders.invoice.seeDraft")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              setOpen("enter")
            }}
          >
            <FilePen />
            {t(pending ? `${R}.enter` : "orders.invoice.addPdf")}
          </Button>
          {pending && document === "expense_voucher" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={waive.isPending}>
                  <Ban />
                  {t(`${R}.waive`)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-xs">
                {WAIVER_REASONS.map((reason) => (
                  <DropdownMenuItem
                    key={reason}
                    onSelect={() => {
                      waive.mutate(
                        { id: record.id, reason },
                        {
                          onSuccess: () => toast.success(t(`${R}.waivedSaved`)),
                          onError: (failure) => toast.error(errorText(t, failure)),
                        }
                      )
                    }}
                  >
                    {t(`${R}.reasons.${reason}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}
      {open === "draft" ? (
        <InvoiceDraftDialog invoiceId={record.id} orderNumber={orderNumber} onClose={close} />
      ) : null}
      {open === "enter" ? <ReturnDocumentDialog record={record} onClose={close} /> : null}
    </li>
  )
}

/**
 * The order's returns' documents (F8 E6, the accountant 2026-10-31): a
 * gider pusulası for a person's return, a company's return invoice for a
 * company's; entered here, or recorded as not needed.
 */
export function ReturnDocuments({
  records,
  mayOpen,
  orderNumber,
}: {
  records: InvoiceRecord[]
  mayOpen: boolean
  orderNumber: number | null
}) {
  const { t } = useTranslation()
  if (records.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-1 border-t pt-3">
      <h3 className="text-sm font-semibold">{t(`${R}.title`)}</h3>
      <ul className="divide-y">
        {records.map((record) => (
          <ReturnRow key={record.id} record={record} mayOpen={mayOpen} orderNumber={orderNumber} />
        ))}
      </ul>
    </div>
  )
}
