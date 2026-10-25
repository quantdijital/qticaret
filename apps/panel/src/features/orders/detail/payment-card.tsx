import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { OrderDetail } from "@/features/orders/api/orders"
import { formatMoney } from "@/lib/format"

// The payment's state in the shop's words (docs/06 sözlük) and its tone
function paymentState(order: OrderDetail) {
  const collections = order.payment_collections
  const amount = collections.reduce((sum, row) => sum + row.amount, 0)
  const captured = collections.reduce((sum, row) => sum + (row.captured_amount ?? 0), 0)
  const refunded = collections.reduce((sum, row) => sum + (row.refunded_amount ?? 0), 0)
  const authorized = collections.some((row) =>
    ["authorized", "partially_authorized"].includes(row.status)
  )
  if (refunded > 0) {
    return {
      key: refunded >= captured ? "refunded" : "partiallyRefunded",
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
  if (authorized) {
    return { key: "authorized", tone: "info", amount, captured, refunded } as const
  }
  return { key: "notPaid", tone: "warning", amount, captured, refunded } as const
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

/** What the customer paid, what the shop has taken and given back. */
export function PaymentCard({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const state = paymentState(order)
  const money = (amount: number) => formatMoney(amount, order.currency_code)
  const provider = order.payment_collections[0]?.payments?.[0]?.provider_id
  return (
    <SectionCard
      title={t("orders.detail.payment")}
      action={<StatusBadge tone={state.tone}>{t(`orders.payment.${state.key}`)}</StatusBadge>}
    >
      <dl className="flex flex-col divide-y">
        <Row label={t("orders.detail.amount")} value={money(state.amount)} />
        <Row label={t("orders.detail.captured")} value={money(state.captured)} />
        {state.refunded > 0 ? (
          <Row label={t("orders.detail.refunded")} value={money(state.refunded)} />
        ) : null}
        {provider ? (
          <Row
            label={t("orders.detail.provider")}
            value={t(`orders.providers.${provider}`, {
              defaultValue: provider.replace(/^pp_/, ""),
            })}
          />
        ) : null}
      </dl>
    </SectionCard>
  )
}
