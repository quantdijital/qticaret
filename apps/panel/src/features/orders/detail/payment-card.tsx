import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { OrderDetail, OrderMoney } from "@/features/orders/api/orders"
import type { HostedPayment } from "@/features/orders/api/payments"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

// The payment's state in the shop's words (docs/06 sözlük) and its tone. Taken
// and refunded come in kuruş from the server once read: Medusa keeps digits
// below a kuruş, so its own sums can leave a refunded order "partly" refunded.
function paymentState(order: OrderDetail, totals: OrderMoney | undefined) {
  const collections = order.payment_collections
  const amount = collections.reduce((sum, row) => sum + row.amount, 0)
  const captured = totals
    ? Number(totals.paid)
    : collections.reduce((sum, row) => sum + (row.captured_amount ?? 0), 0)
  const refunded = totals
    ? Number(totals.refunded)
    : collections.reduce((sum, row) => sum + (row.refunded_amount ?? 0), 0)
  const authorized = collections.some((row) =>
    ["authorized", "partially_authorized"].includes(row.status)
  )
  if (refunded > 0) {
    return {
      key: (totals ? Number(totals.refundable) === 0 : refunded >= captured)
        ? "refunded"
        : "partiallyRefunded",
      tone: "neutral",
      amount,
      captured,
      refunded,
    } as const
  }
  if (captured > 0) {
    return {
      key: captured >= amount ? "captured" : "partiallyCaptured",
      tone: "success",
      amount,
      captured,
      refunded,
    } as const
  }
  // A gift card or store credit covered the whole order: nothing was left to pay (F4.8)
  if (amount === 0 && totals && Number(totals.credit) > 0) {
    return { key: "credit", tone: "success", amount, captured, refunded } as const
  }
  if (authorized) {
    return { key: "authorized", tone: "info", amount, captured, refunded } as const
  }
  return { key: "notPaid", tone: "warning", amount, captured, refunded } as const
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      {/* A provider's long reference breaks onto lines rather than widen a phone's page */}
      <dd className="min-w-0 text-right text-sm font-medium tabular-nums wrap-anywhere">{value}</dd>
    </div>
  )
}

/**
 * What the customer paid, by card and by gift card or store credit, what
 * the shop has taken and given back, and what a refund can still return
 * (from the server, F4.7). On the order's page its invoice is the card's
 * last part (docs/06 "Detay sayfası düzeni"): the rows run in two columns
 * there, the card being the main column's width.
 */
export function PaymentCard({
  order,
  money: totals,
  moneyError,
  hosted,
  invoice,
}: {
  order: OrderDetail
  money?: OrderMoney
  /** The server's money read failed: said so, with a way to try again. */
  moneyError?: { onRetry: () => void }
  /** The order's hosted-form payment as its provider holds it (F5 V7, V10). */
  hosted?: HostedPayment | undefined
  /** The order's invoice part, under the payment's rows. */
  invoice?: ReactNode
}) {
  const { t } = useTranslation()
  const state = paymentState(order, totals)
  const money = (amount: string | number) => formatMoney(amount, order.currency_code)
  const provider = order.payment_collections[0]?.payments?.[0]?.provider_id
  return (
    <SectionCard
      title={t(invoice ? "orders.detail.paymentAndInvoice" : "orders.detail.payment")}
      action={
        <>
          {hosted?.test_mode ? (
            <StatusBadge tone="warning">{t("orders.payment.testMode")}</StatusBadge>
          ) : null}
          <StatusBadge tone={state.tone}>{t(`orders.payment.${state.key}`)}</StatusBadge>
        </>
      }
    >
      <dl
        className={cn(
          "grid grid-cols-1 gap-x-8 [&>div]:border-t [&>div:first-child]:border-t-0",
          invoice ? "md:grid-cols-2 md:[&>div:nth-child(2)]:border-t-0" : ""
        )}
      >
        <Row label={t("orders.detail.amount")} value={money(state.amount)} />
        {totals && Number(totals.credit) > 0 ? (
          <Row label={t("orders.detail.credit")} value={money(totals.credit)} />
        ) : null}
        <Row label={t("orders.detail.captured")} value={money(state.captured)} />
        {state.refunded > 0 ? (
          <Row label={t("orders.detail.refunded")} value={money(state.refunded)} />
        ) : null}
        {totals && Number(totals.paid) > 0 ? (
          <Row label={t("orders.detail.refundable")} value={money(totals.refundable)} />
        ) : null}
        {provider ? (
          <Row
            label={t("orders.detail.provider")}
            value={t(`orders.providers.${provider}`, {
              defaultValue: provider.replace(/^pp_/, ""),
            })}
          />
        ) : null}
        {hosted?.reference ? (
          <Row label={t("orders.detail.transaction")} value={hosted.reference} />
        ) : null}
        {hosted?.card_last4 ? (
          <Row
            label={t("orders.detail.card")}
            value={`${hosted.card_brand ?? ""} •••• ${hosted.card_last4}`.trim()}
          />
        ) : null}
        {hosted?.installments ? (
          <Row
            label={t("orders.detail.installments")}
            value={
              hosted.installments > 1
                ? t("orders.detail.installmentCount", { count: hosted.installments })
                : t("orders.detail.singlePayment")
            }
          />
        ) : null}
        {hosted?.fraud_status === 0 || hosted?.fraud_status === -1 ? (
          <Row
            label={t("orders.detail.fraud")}
            value={t(
              `orders.detail.fraudStatus.${hosted.fraud_status === 0 ? "review" : "refused"}`
            )}
          />
        ) : null}
      </dl>
      {hosted && !hosted.available ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("orders.detail.providerUnreachable")}
        </p>
      ) : null}
      {moneyError ? (
        <div className="mt-3">
          <ErrorState text={t("orders.detail.moneyFailed")} onRetry={moneyError.onRetry} />
        </div>
      ) : null}
      {invoice ? <div className="mt-4 border-t pt-4">{invoice}</div> : null}
    </SectionCard>
  )
}
