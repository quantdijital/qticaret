import { FileDown, FilePen, FileSearch, Loader2, RotateCcw } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  ADVANCE_ONLY,
  advanceOf,
  invoicePdfUrl,
  useRetryInvoice,
} from "@/features/orders/api/invoices"
import type { InvoiceRecord } from "@/features/orders/api/invoices"
import { InvoiceDraftDialog } from "@/features/orders/detail/invoice-draft-dialog"
import { InvoiceEntryDialog } from "@/features/orders/detail/invoice-entry-dialog"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"

const V = "orders.invoice"

const TONES: Readonly<Record<InvoiceRecord["status"], StatusTone>> = {
  pending: "info",
  issuing: "info",
  issued: "success",
  failed: "danger",
  cancelled: "neutral",
  waived: "neutral",
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * One sale invoice (F8, adr/0034): where it stands at its program, its
 * number and PDF; a stopped one tried again, and one issued elsewhere
 * (the shop's own program, Luca by hand) read as a draft, then typed in
 * with its PDF. The order's first sale, or an exchange's (E6b).
 */
export function SaleInvoice({
  invoice,
  mayOpen,
  orderNumber,
}: {
  invoice: InvoiceRecord
  mayOpen: boolean
  orderNumber: number | null
}) {
  const { t } = useTranslation()
  const retry = useRetryInvoice()
  const [entry, setEntry] = useState<"full" | "pdf" | null>(null)
  const [opening, setOpening] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const closeDraft = useCallback(() => {
    setDrafting(false)
  }, [])
  const fail = (failure: unknown) => toast.error(errorText(t, failure))
  const openPdf = async (id: string) => {
    setOpening(true)
    try {
      const url = await invoicePdfUrl(id)
      window.open(url, "_blank", "noopener")
      // The new tab holds its own copy once it has loaded: the link is let go after a while
      window.setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 60_000)
    } catch (failure) {
      fail(failure)
    } finally {
      setOpening(false)
    }
  }
  const external = invoice.provider === "external"
  // Gift card lines stay off the invoice: their money is an advance (adr/0025 Ek 2026-11-03)
  const advance = advanceOf(invoice)
  const advanceOnly = invoice.status === "waived" && invoice.waived_reason === ADVANCE_ONLY
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={TONES[invoice.status]}>{t(`${V}.status.${invoice.status}`)}</StatusBadge>
        <span className="text-xs text-muted-foreground">
          {t(`${V}.providers.${invoice.provider}`, { defaultValue: "—" })}
        </span>
      </div>
      <dl className="divide-y">
        {invoice.number ? <Row label={t(`${V}.number`)} value={invoice.number} /> : null}
        {invoice.document_type ? (
          <Row label={t(`${V}.type`)} value={t(`${V}.types.${invoice.document_type}`)} />
        ) : null}
        {invoice.issued_at ? (
          <Row label={t(`${V}.issuedAt`)} value={formatDateTime(invoice.issued_at)} />
        ) : null}
        {advance ? <Row label={t(`${V}.advance`)} value={formatMoney(advance, "try")} /> : null}
      </dl>
      {advanceOnly || advance ? (
        <p className="text-[13px] text-muted-foreground">
          {t(advanceOnly ? `${V}.advanceOnly` : `${V}.advanceHint`)}
        </p>
      ) : null}
      {invoice.status === "failed" ? (
        <p className="text-[13px] text-destructive-text">
          {t(`${V}.reasons.${(invoice.last_error ?? "").replace(/\./g, "_")}`, {
            defaultValue: t(`${V}.failed`, {
              code: invoice.last_error ?? "—",
              attempts: invoice.attempts,
            }),
          })}
        </p>
      ) : null}
      {invoice.status === "issued" && invoice.last_error === "einvoice.return_document_needed" ? (
        <p className="text-[13px] text-destructive-text">{t(`${V}.returnNeeded`)}</p>
      ) : null}
      {invoice.status === "pending" && external ? (
        <p className="text-[13px] text-muted-foreground">{t(`${V}.waitingExternal`)}</p>
      ) : null}
      {invoice.program_difference ? (
        <p className="text-[13px] text-muted-foreground">
          {t(`${V}.difference`, { kurus: invoice.program_difference })}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {invoice.has_pdf && mayOpen ? (
          <Button variant="outline" disabled={opening} onClick={() => void openPdf(invoice.id)}>
            {opening ? <Loader2 className="animate-spin" /> : <FileDown />}
            {t(`${V}.pdf`)}
          </Button>
        ) : null}
        {invoice.status === "failed" ? (
          <Button
            variant="outline"
            disabled={retry.isPending}
            onClick={() => {
              retry.mutate(invoice.id, {
                onSuccess: () => toast.success(t(`${V}.retried`)),
                onError: fail,
              })
            }}
          >
            <RotateCcw />
            {t(`${V}.retry`)}
          </Button>
        ) : null}
        {external && mayOpen && (invoice.status === "pending" || invoice.status === "failed") ? (
          <Button
            variant="outline"
            onClick={() => {
              setDrafting(true)
            }}
          >
            <FileSearch />
            {t(`${V}.seeDraft`)}
          </Button>
        ) : null}
        {external && invoice.status === "pending" ? (
          <Button
            variant="outline"
            onClick={() => {
              setEntry("full")
            }}
          >
            <FilePen />
            {t(`${V}.enter`)}
          </Button>
        ) : null}
        {external && invoice.status === "issued" && !invoice.has_pdf ? (
          <Button
            variant="outline"
            onClick={() => {
              setEntry("pdf")
            }}
          >
            <FilePen />
            {t(`${V}.addPdf`)}
          </Button>
        ) : null}
      </div>
      {drafting ? (
        <InvoiceDraftDialog invoiceId={invoice.id} orderNumber={orderNumber} onClose={closeDraft} />
      ) : null}
      {entry ? (
        <InvoiceEntryDialog
          invoiceId={invoice.id}
          numbered={entry === "pdf"}
          onClose={() => {
            setEntry(null)
          }}
        />
      ) : null}
    </div>
  )
}
