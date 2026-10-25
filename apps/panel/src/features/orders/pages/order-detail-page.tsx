import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { orderQuery, orderStateQuery } from "@/features/orders/api/orders"
import { StageBadge } from "@/features/orders/components/stage-badge"
import { ItemsCard } from "@/features/orders/detail/items-card"
import { OrderActions } from "@/features/orders/detail/order-actions"
import { PaymentCard } from "@/features/orders/detail/payment-card"
import { AddressCard, CustomerCard } from "@/features/orders/detail/people-cards"
import { ProgressCard } from "@/features/orders/detail/progress-card"
import { errorText } from "@/lib/errors"
import { formatLongDate } from "@/lib/format"

const route = getRouteApi("/_auth/orders/$id")

/**
 * One order (docs/06 §4): where it stands and the next step at the top,
 * the parcel and the money on the left, the customer on the right.
 */
export function OrderDetailPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const query = useQuery(orderQuery(id))
  const state = useQuery(orderStateQuery(id))
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
        action={<OrderActions order={order} state={state.data} />}
      />
      <ProgressCard order={order} stage={state.data.stage} />
      <div className="grid items-start gap-[var(--grid-gap)] xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:col-span-8">
          <ItemsCard order={order} />
        </div>
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:col-span-4">
          <CustomerCard order={order} />
          <AddressCard order={order} />
          <PaymentCard order={order} />
        </div>
      </div>
    </div>
  )
}
