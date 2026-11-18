import { useTranslation } from "react-i18next"
import type { InvoiceRecord } from "@/features/orders/api/invoices"

const F = "orders.invoice.birfatura"

/** Staff's flag on a canceled order's invoice (the server's `requestCancel`). */
export const RETURN_NEEDED = "einvoice.return_document_needed"

/**
 * What a BirFatura invoice asks of staff (adr/0072), one line: the order
 * was canceled after BirFatura had it (pulled, or issued: look there,
 * cancel or issue a return document); a report that could not be taken
 * (no number, no PDF, another series), with the code for anything new;
 * or, waiting, that BirFatura pulls it and writes it back by itself.
 */
export function BirfaturaNote({ invoice }: { invoice: InvoiceRecord }) {
  const { t } = useTranslation()
  const code = invoice.last_error
  if (code === RETURN_NEEDED && (invoice.status === "pending" || invoice.status === "issued")) {
    return <p className="text-[13px] text-destructive-text">{t(`${F}.canceled`)}</p>
  }
  if (code && (invoice.status === "pending" || invoice.status === "issued")) {
    return (
      <p className="text-[13px] text-warning-text">
        {t(`${F}.problems.${code.replace(/\./g, "_")}`, {
          defaultValue: t(`${F}.problem`, { code }),
        })}
      </p>
    )
  }
  if (invoice.status === "pending") {
    return <p className="text-[13px] text-muted-foreground">{t(`${F}.waiting`)}</p>
  }
  return null
}
