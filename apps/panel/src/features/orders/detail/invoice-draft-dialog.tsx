import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useInvoiceDraft } from "@/features/orders/api/invoices"
import type { DraftLine, InvoiceDraft } from "@/features/orders/api/invoices"
import { errorText } from "@/lib/errors"
import { formatDate, formatMoney } from "@/lib/format"
import { isReauthCancelled } from "@/lib/reauth"

const V = "orders.invoice.draft"
// Written on an e-Arşiv for a buyer who gave no T.C. kimlik number (backend lib/invoicing)
const ANONYMOUS_TCKN = "11111111111"

const lira = (amount: string) => formatMoney(amount, "try")
// A unit price KDV excluded keeps its four decimals, as the program is sent it
const unitPrice = (amount: string) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(amount))

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3 py-1.5">
          <dt className="text-[13px] text-muted-foreground">{label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Panel({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string | undefined
}) {
  return (
    <section
      className={`flex h-full min-w-0 flex-col gap-2 rounded-lg border p-4 ${className ?? ""}`}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** Each KDV rate's base and tax, from the lines' own rounded amounts. */
function byRate(lines: DraftLine[]) {
  const rates = new Map<number, { net: number; vat: number }>()
  for (const line of lines) {
    const sum = rates.get(line.vat_rate) ?? { net: 0, vat: 0 }
    rates.set(line.vat_rate, {
      net: Math.round((sum.net + Number(line.net)) * 100) / 100,
      vat: Math.round((sum.vat + Number(line.vat)) * 100) / 100,
    })
  }
  return [...rates.entries()].sort(([a], [b]) => b - a)
}

/** A return's document: the sale invoice it belongs to, and how the money went back. */
function ReturnOfPanel({ draft }: { draft: InvoiceDraft }) {
  const { t } = useTranslation()
  const of = draft.return_of
  if (!of) {
    return null
  }
  return (
    <Panel title={t(`${V}.returnOf`)}>
      <Rows
        rows={[
          [t(`${V}.document`), t(`orders.invoice.returns.kinds.${of.document}`)],
          [t(`${V}.originalNumber`), of.number ?? "—"],
          [t(`${V}.originalDate`), of.issued_on ? formatDate(of.issued_on) : "—"],
          [t(`${V}.refundedBy`), t(`${V}.payments.${draft.internet_sale.payment}`)],
        ]}
      />
      {draft.internet_sale.payment === "card" && of.document === "expense_voucher" ? (
        <p className="text-[13px] text-muted-foreground">{t(`${V}.institutionHint`)}</p>
      ) : null}
    </Panel>
  )
}

function DraftView({ draft }: { draft: InvoiceDraft }) {
  const { t } = useTranslation()
  const { buyer, internet_sale: sale, shipment } = draft
  const gift = sale.payment === "gift_card"
  const place = [buyer.district, buyer.city, buyer.postal_code].filter(Boolean).join(" / ")
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title={t(`${V}.buyer`)}>
          <Rows
            rows={[
              [t(`${V}.name`), buyer.name],
              [
                t(buyer.kind === "company" ? `${V}.vkn` : `${V}.tckn`),
                buyer.tax_id === ANONYMOUS_TCKN
                  ? t(`${V}.anonymous`, { number: ANONYMOUS_TCKN })
                  : buyer.tax_id,
              ],
              ...(buyer.tax_office
                ? [[t(`${V}.taxOffice`), buyer.tax_office] as [string, ReactNode]]
                : []),
              [t(`${V}.address`), [buyer.address, place].filter(Boolean).join(", ")],
              ...(buyer.email ? [[t(`${V}.email`), buyer.email] as [string, ReactNode]] : []),
              ...(buyer.phone ? [[t(`${V}.phone`), buyer.phone] as [string, ReactNode]] : []),
            ]}
          />
        </Panel>
        {draft.return_of ? <ReturnOfPanel draft={draft} /> : null}
        <Panel title={t(`${V}.sale`)} className={draft.return_of ? "hidden" : undefined}>
          <Rows
            rows={[
              [t(`${V}.url`), sale.url],
              [t(`${V}.payment`), t(`${V}.payments.${sale.payment}`)],
              // A card paying in full: e-Arşiv's ODEMEARACISI, the intermediary named as Paraşüt names it
              [t(`${V}.platform`), sale.platform ?? (gift ? t(`${V}.payments.gift_card`) : "—")],
              [t(`${V}.paidOn`), formatDate(sale.paid_on)],
              [
                t(`${V}.carrier`),
                shipment
                  ? `${shipment.carrier.title} (${shipment.carrier.tax_id})`
                  : t(`${V}.notShipped`),
              ],
              ...(shipment
                ? [[t(`${V}.shippedOn`), formatDate(shipment.shipped_on)] as [string, ReactNode]]
                : []),
            ]}
          />
        </Panel>
      </div>
      {/* On a phone each line stacks; the table needs the width */}
      <ul className="divide-y rounded-lg border text-sm sm:hidden">
        {draft.lines.map((line, index) => (
          <li key={`${line.description}-${String(index)}`} className="flex flex-col gap-1 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 [overflow-wrap:anywhere]">{line.description}</span>
              <span className="font-medium tabular-nums">{lira(line.gross)}</span>
            </div>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {t(`${V}.lineSummary`, {
                quantity: line.quantity,
                unit: unitPrice(line.unit_net),
                rate: line.vat_rate,
                vat: lira(line.vat),
              })}
              {Number(line.discount_net) > 0
                ? ` · ${t(`${V}.discount`)} ${lira(line.discount_net)}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-lg border sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t(`${V}.line`)}</th>
              <th className="px-3 py-2 text-right font-medium">{t(`${V}.quantity`)}</th>
              <th className="px-3 py-2 text-right font-medium">{t(`${V}.unit`)}</th>
              <th className="px-3 py-2 text-right font-medium">{t(`${V}.discount`)}</th>
              <th className="px-3 py-2 text-right font-medium">{t(`${V}.vat`)}</th>
              <th className="px-3 py-2 text-right font-medium">{t(`${V}.gross`)}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {draft.lines.map((line, index) => (
              <tr key={`${line.description}-${String(index)}`}>
                <td className="px-3 py-2">{line.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{unitPrice(line.unit_net)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(line.discount_net) > 0 ? lira(line.discount_net) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  %{line.vat_rate} · {lira(line.vat)}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {lira(line.gross)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title={t(`${V}.byRate`)}>
          <Rows
            rows={byRate(draft.lines).map(([rate, sum]) => [
              t(`${V}.rate`, { rate }),
              t(`${V}.rateSum`, { net: lira(String(sum.net)), vat: lira(String(sum.vat)) }),
            ])}
          />
        </Panel>
        <Panel title={t(`${V}.totals`)}>
          <Rows
            rows={[
              [t(`${V}.net`), lira(draft.totals.net)],
              [t(`${V}.vatTotal`), lira(draft.totals.vat)],
              [t(`${V}.grossTotal`), <strong key="gross">{lira(draft.totals.gross)}</strong>],
            ]}
          />
        </Panel>
      </div>
    </div>
  )
}

/**
 * The invoice as the shop's program is to issue it (adr/0034 §9): what to
 * type into Luca or another program by hand. Not an invoice itself. Asked
 * for on opening, after the person proves themselves again.
 */
export function InvoiceDraftDialog({
  invoiceId,
  orderNumber,
  onClose,
}: {
  invoiceId: string
  orderNumber: number | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const read = useInvoiceDraft()
  const { mutate } = read
  useEffect(() => {
    mutate(invoiceId, {
      onError: (failure) => {
        if (isReauthCancelled(failure)) {
          onClose()
        }
      },
    })
  }, [invoiceId, mutate, onClose])
  const problems = read.data?.problems ?? []
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t(
              read.data?.draft?.return_of
                ? `${V}.returnTitle.${read.data.draft.return_of.document}`
                : `${V}.title`,
              { number: orderNumber === null ? "" : `#${String(orderNumber)}` }
            )}
          </DialogTitle>
          <DialogDescription>
            {t(`${V}.description`)}
            {read.data?.series ? ` ${t(`${V}.series`, { series: read.data.series })}` : ""}
          </DialogDescription>
        </DialogHeader>
        {read.isPending || read.isIdle ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        ) : read.isError ? (
          <p className="text-sm text-destructive-text">{errorText(t, read.error)}</p>
        ) : read.data.draft ? (
          <DraftView draft={read.data.draft} />
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p>{t(`${V}.blocked`)}</p>
            <ul className="list-disc pl-5 text-destructive-text">
              {problems.map((code) => (
                <li key={code}>
                  {t(`orders.invoice.reasons.${code.replace(/\./g, "_")}`, {
                    defaultValue: t(`${V}.problem`, { code }),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
