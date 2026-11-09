import { useQuery } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/api/staff"
import { orderInvoicesQuery } from "@/features/orders/api/invoices"
import type { SaleHold } from "@/features/orders/api/invoices"
import { ReturnDocuments } from "@/features/orders/detail/return-documents"
import { SaleInvoice } from "@/features/orders/detail/sale-invoice"
import { errorText } from "@/lib/errors"

const V = "orders.invoice"

/**
 * Why the order has no sale invoice (the server's rule): an information,
 * not an error (a test payment, invoicing off, waiting for the parcel).
 */
function SaleHoldNotice({ hold }: { hold: SaleHold }) {
  const { t } = useTranslation()
  const provider = hold.payment_provider
    ? t(`orders.providers.${hold.payment_provider}`, { defaultValue: "" })
    : ""
  const key = hold.reason === "test_payment" && !provider ? "test_payment_unnamed" : hold.reason
  return (
    <Alert>
      <Info aria-hidden="true" />
      <AlertDescription>{t(`${V}.hold.${key}`, { provider })}</AlertDescription>
    </Alert>
  )
}

/**
 * The order's invoices (F8, adr/0034): its sale invoice; each exchange's
 * own sale for what it sent instead (E6b, the accountant 2026-10-31: a
 * swap is a return and a new sale); and the returns' documents. A part
 * of the payment card (docs/06 "Detay sayfası düzeni": the money and its
 * invoice read together), under its own heading.
 */
export function InvoiceSection({
  orderId,
  orderNumber = null,
}: {
  orderId: string
  orderNumber?: number | null | undefined
}) {
  const { t } = useTranslation()
  const query = useQuery(orderInvoicesQuery(orderId))
  // The PDF names the buyer and their tax id: not for every role (adr/0034 §9)
  const mayOpen = useCan("invoices")
  const rows = query.data?.invoices ?? []
  const invoice = rows.find((row) => row.kind === "sale" && !row.for_exchange) ?? null
  const exchanges = rows.filter((row) => row.kind === "sale" && row.for_exchange)
  const returns = rows.filter((row) => row.kind === "return")
  const number = orderNumber ?? null
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{t(`${V}.title`)}</h3>
      {query.isPending ? (
        <Skeleton className="h-20 rounded-md" />
      ) : query.isError ? (
        <p className="text-[13px] text-muted-foreground">{errorText(t, query.error)}</p>
      ) : !invoice && exchanges.length === 0 ? (
        query.data.sale_hold ? (
          <SaleHoldNotice hold={query.data.sale_hold} />
        ) : (
          <p className="text-[13px] text-muted-foreground">{t(`${V}.none`)}</p>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {invoice ? (
            <SaleInvoice invoice={invoice} mayOpen={mayOpen} orderNumber={number} />
          ) : null}
          {exchanges.length > 0 ? (
            <div className="flex flex-col gap-3 border-t pt-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold">{t(`${V}.exchanges.title`)}</h3>
                <p className="text-[13px] text-muted-foreground">{t(`${V}.exchanges.hint`)}</p>
              </div>
              {exchanges.map((row) => (
                <SaleInvoice key={row.id} invoice={row} mayOpen={mayOpen} orderNumber={number} />
              ))}
            </div>
          ) : null}
          <ReturnDocuments records={returns} mayOpen={mayOpen} orderNumber={number} />
        </div>
      )}
    </div>
  )
}
