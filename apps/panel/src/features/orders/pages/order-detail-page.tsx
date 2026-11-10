import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { Printer } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { openPrint } from "@/features/orders/print/open-print"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { BankTransferAlert } from "@/features/orders/detail/bank-transfer-alert"
import { ChargebackAlert } from "@/features/orders/detail/chargeback-alert"
import { PickupAlert } from "@/features/orders/detail/pickup-alert"
import { orderMoneyQuery, orderQuery, orderStateQuery } from "@/features/orders/api/orders"
import type { OrderDetail } from "@/features/orders/api/orders"
import { orderPaymentDetailsQuery } from "@/features/orders/api/payments"
import { returnRequestsQuery } from "@/features/orders/api/returns"
import { StageBadge } from "@/features/orders/components/stage-badge"
import { StockShortBadge } from "@/features/orders/components/stock-short-badge"
import { ItemsCard } from "@/features/orders/detail/items-card"
import { NotesCard } from "@/features/orders/detail/notes-card"
import { OrderActions } from "@/features/orders/detail/order-actions"
import { PaymentCard } from "@/features/orders/detail/payment-card"
import { InvoiceSection } from "@/features/orders/detail/invoice-card"
import { OrderTabs } from "@/features/orders/detail/order-tabs"
import { CustomerCard } from "@/features/orders/detail/people-cards"
import { ProgressCard } from "@/features/orders/detail/progress-card"
import { ReturnsCard } from "@/features/orders/detail/returns-card"
import { StockShortAlert } from "@/features/orders/detail/stock-short-alert"
import { stockShortLines } from "@/features/orders/stock-short"
import {
  orderPaymentLinkId,
  orderPaymentLinkNumber,
} from "@/features/payment-links/components/order-link"
import { PaymentLinkChip } from "@/features/payment-links/components/payment-link-chip"
import { errorText } from "@/lib/errors"
import { formatLongDate, formatMoney } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/orders/$id")

/** Who ordered, as the header names them: the customer, else the parcel's addressee. */
function buyerOf(order: OrderDetail): string {
  const customer = [order.customer?.first_name, order.customer?.last_name]
  const addressee = [order.shipping_address?.first_name, order.shipping_address?.last_name]
  return customer.filter(Boolean).join(" ") || addressee.filter(Boolean).join(" ")
}

/**
 * One order (docs/06 "Detay sayfası düzeni"): its number, stage, customer,
 * total and next step at the top; how far it has come; a return waiting
 * for a decision; then what was bought, the money and the invoice in the
 * main column, the customer with the address and the team's notes beside
 * them; what the customer was sent, refunds, disputes and the contracts
 * in tabs under them.
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
  // A return or exchange is a card at the top; none is a row in the tabs
  const returns = useQuery(returnRequestsQuery({ order_id: id }))
  const hasReturns = returns.data ? returns.data.return_requests.length > 0 : undefined
  const hosted = details.data?.payments[0]
  const refunds = details.data?.refunds ?? []
  const order = query.data
  const back = { to: "/orders", label: t("nav.orders") }
  const linkId = orderPaymentLinkId(order?.metadata)
  const linkNumber = orderPaymentLinkNumber(order?.metadata)
  // A paid order placed short of stock (adr/0026 Ek 2026-11-06), while there is still something to send
  const short =
    state.data?.stage === "awaiting_payment" || state.data?.stage === "to_ship"
      ? stockShortLines(order?.metadata)
      : []

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
        description={[
          t("orders.detail.placed", { date: formatLongDate(order.created_at) }),
          buyerOf(order),
          formatMoney(money.data?.net ?? order.total, order.currency_code),
        ]
          .filter(Boolean)
          .join(" · ")}
        badge={
          <>
            <StageBadge stage={state.data.stage} />
            <StockShortBadge units={short.reduce((sum, line) => sum + line.short, 0)} />
            {linkId ? <PaymentLinkChip linkId={linkId} number={linkNumber} /> : null}
          </>
        }
        back={back}
        action={
          <>
            {/* The order's packing slip on A4, in a new tab that prints itself */}
            <Button
              variant="outline"
              onClick={() => {
                openPrint("slip", [order.id])
              }}
            >
              <Printer />
              {t("orders.print.button")}
            </Button>
            <OrderActions
              order={order}
              state={state.data}
              money={money.data}
              testPaid={hosted?.test_mode === true}
            />
          </>
        }
      />
      <ChargebackAlert orderId={order.id} />
      <StockShortAlert lines={short} />
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
      {/* A request waiting for a decision first, the width of the page */}
      <ReturnsCard orderId={order.id} />
      <PageGrid>
        <PageColumn span={8}>
          <ItemsCard order={order} {...(money.data ? { money: money.data } : {})} />
          <PaymentCard
            order={order}
            {...(money.data ? { money: money.data } : {})}
            {...(money.error ? { moneyError: { onRetry: () => void money.refetch() } } : {})}
            hosted={hosted}
            invoice={<InvoiceSection orderId={order.id} orderNumber={order.display_id} />}
          />
        </PageColumn>
        <PageColumn span={4}>
          <CustomerCard order={order} editable={state.data.cancelable} />
          {/* Last: the column's last card grows, and the note box sits at its foot */}
          <NotesCard orderId={order.id} />
        </PageColumn>
      </PageGrid>
      <OrderTabs
        orderId={order.id}
        currency={order.currency_code}
        refunds={refunds}
        hasReturns={hasReturns}
      />
    </div>
  )
}
