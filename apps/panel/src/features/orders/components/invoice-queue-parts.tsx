import { Loader2, RotateCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import { MAX_BULK_RETRY, useRetryInvoices } from "@/features/orders/api/invoices"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { QueueDialog } from "@/features/orders/components/queue-dialog"
import { ReturnDocuments } from "@/features/orders/detail/return-documents"
import { SaleInvoice } from "@/features/orders/detail/sale-invoice"
import { errorText } from "@/lib/errors"

const V = "orders.invoice"

/**
 * Above the queue while invoices are picked: how many, and "Yeniden dene"
 * for the stopped ones among them, each tried again as its own retry would;
 * what came back says how many went and why the others did not.
 */
export function InvoiceBulkBar({
  picked,
  onClear,
}: {
  picked: ReadonlyMap<string, InvoiceRecord>
  onClear: () => void
}) {
  const { t } = useTranslation()
  const retry = useRetryInvoices()
  const stopped = [...picked.values()].filter((row) => row.status === "failed")
  const tooMany = stopped.length > MAX_BULK_RETRY
  return (
    <div
      role="region"
      aria-label={t(`${V}.bulk.region`)}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/60 px-5 py-2.5 text-sm"
    >
      <span className="font-medium" aria-live="polite">
        {t(`${V}.bulk.selected`, { count: picked.size })}
      </span>
      {tooMany ? (
        <span className="text-destructive-text">
          {t(`${V}.bulk.tooMany`, { max: MAX_BULK_RETRY })}
        </span>
      ) : null}
      <span className="ml-auto flex w-full flex-wrap justify-end gap-2 sm:w-auto">
        <Button variant="ghost" size="sm" disabled={retry.isPending} onClick={onClear}>
          {t("orders.bulkShip.clear")}
        </Button>
        <Button
          size="sm"
          disabled={stopped.length === 0 || tooMany || retry.isPending}
          onClick={() => {
            retry.mutate(
              stopped.map((row) => row.id),
              {
                onSuccess: (results) => {
                  const done = results.filter((result) => result.ok).length
                  const failed = results.filter((result) => !result.ok)
                  if (done > 0) {
                    toast.success(t(`${V}.bulk.retried`, { count: done }))
                  }
                  if (failed.length > 0) {
                    toast.error(
                      t(`${V}.bulk.notRetried`, {
                        count: failed.length,
                        reason: failed[0]?.message ?? "",
                      })
                    )
                  }
                  onClear()
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          {retry.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {t(`${V}.bulk.retry`, { count: stopped.length })}
        </Button>
      </span>
    </div>
  )
}

/** A queue row opened: the invoice as its order page shows it, with its own actions. */
export function InvoiceDialog({
  invoice,
  onClose,
}: {
  invoice: InvoiceRecord | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  // The PDF names the buyer and their tax id: not for every role (adr/0034 §9)
  const mayOpen = useCan("invoices")
  const number = invoice?.order_display_id ?? null
  return (
    <QueueDialog
      open={invoice !== null}
      onClose={onClose}
      title={t(`${V}.dialogTitle`, { number: number ?? "—" })}
      orderId={invoice?.order_id ?? null}
    >
      {invoice === null ? null : invoice.kind === "sale" ? (
        <SaleInvoice invoice={invoice} mayOpen={mayOpen} orderNumber={number} />
      ) : (
        <ReturnDocuments records={[invoice]} mayOpen={mayOpen} orderNumber={number} />
      )}
    </QueueDialog>
  )
}
