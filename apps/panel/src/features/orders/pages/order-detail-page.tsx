import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BankTransferAlert } from "@/features/orders/detail/bank-transfer-alert"
import { ChargebackAlert } from "@/features/orders/detail/chargeback-alert"
import { PickupAlert } from "@/features/orders/detail/pickup-alert"
import { orderMoneyQuery, orderQuery, orderStateQuery } from "@/features/orders/api/orders"
import { orderPaymentDetailsQuery } from "@/features/orders/api/payments"
import { StageBadge } from "@/features/orders/components/stage-badge"
import { MessageHistoryCard } from "@/features/customers/components/message-history-card"
import { ItemsCard } from "@/features/orders/detail/items-card"
import { NotesCard } from "@/features/orders/detail/notes-card"
import { OrderActions } from "@/features/orders/detail/order-actions"
import { PaymentCard } from "@/features/orders/detail/payment-card"
import { ContractsCard } from "@/features/orders/detail/contracts-card"
import { InvoiceCard } from "@/features/orders/detail/invoice-card"
import { AddressCard, CustomerCard } from "@/features/orders/detail/people-cards"
import { ProgressCard } from "@/features/orders/detail/progress-card"
import { RefundsCard } from "@/features/orders/detail/refunds-card"
import { ReturnsCard } from "@/features/orders/detail/returns-card"
import { errorText } from "@/lib/errors"
import { formatLongDate } from "@/lib/format"

const route = getRouteApi("/_auth/orders/$id")

/**
 * One order (docs/06 §4): where it stands and the next step at the top,
 * the parcel, the money and what the customer was sent on the left, the
 * customer, the contracts they accepted and the team's notes on the right.
 */
export function OrderDetailPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const query = useQuery(orderQuery(id))
  const state = useQuery(orderStateQuery(id))
  // The page does not wait for it: lines show Medusa's totals until it comes
  const money = useQuery(orderMoneyQuery(id))
  // PayTR is asked when the page opens (F5 V7); the page does not wait for it either
  const details = useQuery(orderPaymentDetailsQuery(id))
  const hosted = details.data?.payments[0]
  const refunds = details.data?.refunds ?? []
  const order = query.data
  const back = { to: "/orders", label: t("nav.orders") }

  const failed = query.error ?? state.error
  if (failed) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("orders.detail.title")} back={back} />
        <ErrorState
          text={errorText(t, failed)}
          onRetry={() => {
            void query.refetch()
            void state.refetch()
          }}
        />
      </div>
    )
  }
  if (!order || !state.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-28 rounded-lg" />
        <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
          <Skeleton className="h-80 rounded-lg xl:col-span-8" />
          <Skeleton className="h-80 rounded-lg xl:col-span-4" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("orders.detail.number", { number: order.display_id })}
        description={t("orders.detail.placed", { date: formatLongDate(order.created_at) })}
        badge={<StageBadge stage={state.data.stage} />}
        back={back}
        action={
          <OrderActions
            order={order}
            state={state.data}
            money={money.data}
            testPaid={hosted?.test_mode === true}
          />
        }
      />
      <ChargebackAlert orderId={order.id} />
      {details.data?.bank_transfer?.awaiting && order.status !== "canceled" ? (
        <BankTransferAlert
          orderId={order.id}
          displayId={order.display_id ?? 0}
          state={details.data.bank_transfer}
        />
      ) : null}
      {state.data.pickup.length > 0 ? <PickupAlert parcels={state.data.pickup} /> : null}
      {hosted?.test_mode ? (
        <Alert>
          <AlertDescription>{t("orders.detail.testPaid")}</AlertDescription>
        </Alert>
      ) : null}
      <ProgressCard order={order} stage={state.data.stage} />
      <PageGrid>
        <PageColumn span={8}>
          {/* A request waiting for a decision first: the column's last card grows, not this one */}
          <ReturnsCard orderId={order.id} />
          <ItemsCard order={order} {...(money.data ? { money: money.data } : {})} />
          {refunds.length > 0 ? (
            <RefundsCard refunds={refunds} currency={order.currency_code} />
          ) : null}
          <MessageHistoryCard orderId={order.id} />
        </PageColumn>
        <PageColumn span={4}>
          <CustomerCard order={order} />
          <AddressCard order={order} editable={state.data.cancelable} />
          <PaymentCard
            order={order}
            {...(money.data ? { money: money.data } : {})}
            {...(money.error ? { moneyError: { onRetry: () => void money.refetch() } } : {})}
            hosted={hosted}
          />
          <InvoiceCard orderId={order.id} />
          <ContractsCard orderId={order.id} />
          {/* Last: the column's last card grows, and the note box sits at its foot */}
          <NotesCard orderId={order.id} />
        </PageColumn>
      </PageGrid>
    </div>
  )
}
