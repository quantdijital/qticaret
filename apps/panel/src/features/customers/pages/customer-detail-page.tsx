import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { EmptyRow } from "@qticaret/admin-ui/patterns/empty-row"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { PageTabs } from "@qticaret/admin-ui/patterns/page-tabs"
import type { PageTab } from "@qticaret/admin-ui/patterns/page-tabs"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { customerQuery } from "@/features/customers/api/customers"
import type { CustomerDetail } from "@/features/customers/api/customers"
import { messageHistoryQuery } from "@/features/customers/api/messages"
import { customerName } from "@/features/customers/names"
import { GIFT_CARDS_FLAG } from "@/features/gift-cards/api/gift-cards"
import { StoreCreditCard } from "@/features/gift-cards/components/store-credit-card"
import { StageBadge } from "@/features/orders/components/stage-badge"
import { orderBoardQuery } from "@/features/orders/api/orders"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { formatDate, formatMoney } from "@qticaret/admin-ui/lib/format"
import { ConsentCard } from "@/features/customers/components/consent-card"
import { CustomerGroupsCard } from "@/features/customers/components/customer-groups-card"
import { CustomerInfoCard } from "@/features/customers/components/customer-info-card"
import { MessageHistoryCard } from "@/features/customers/components/message-history-card"
import { PrivacyRequestsCard } from "@/features/customers/components/privacy-requests-card"

const route = getRouteApi("/_auth/customers/$id")

// The order board's own stage rule, so the stages here match the order list; a
// wholesaler's wholesale orders too (ADR-0068 Ek 2026-11-15 (2))
const ordersOf = (customerId: string) =>
  orderBoardQuery({ stage: "all", q: "", page: 0, customerId, segment: "all" })

function OrdersCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const query = useQuery(ordersOf(customerId))
  if (query.data?.orders.length === 0) {
    return <EmptyRow text={t("customers.detail.noOrders")} />
  }
  return (
    <SectionCard title={t("customers.detail.orders")} flush>
      <AsyncBody query={query} skeleton={<Skeleton className="mx-5 mb-5 h-40" />}>
        {(data) => (
          <ul className="flex flex-col">
            {data.orders.map((order) => (
              <li key={order.id} className="border-t">
                <Link
                  to="/orders/$id"
                  params={{ id: order.id }}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
                >
                  <span className="w-16 font-medium tabular-nums">#{order.display_id}</span>
                  <span className="flex-1 text-sm text-muted-foreground">
                    {formatDate(order.created_at)}
                  </span>
                  <StageBadge stage={order.stage} />
                  <span className="w-28 text-right text-sm font-medium tabular-nums">
                    {formatMoney(order.total, order.currency_code)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AsyncBody>
    </SectionCard>
  )
}

/** The customer's records, one card a tab; their orders first, the most looked at. */
function CustomerTabs({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation()
  const storeCredit = useFeature(GIFT_CARDS_FLAG)
  const orders = useQuery(ordersOf(customer.id))
  const messages = useQuery(messageHistoryQuery({ customerId: customer.id }))
  const tabs: PageTab[] = [
    {
      key: "orders",
      label: t("customers.detail.tabs.orders"),
      count: orders.data?.count,
      content: <OrdersCard customerId={customer.id} />,
    },
    {
      key: "messages",
      label: t("customers.messages.title"),
      count: messages.data?.messages.length,
      content: <MessageHistoryCard customerId={customer.id} />,
    },
    {
      key: "consents",
      label: t("customers.consents.title"),
      content: <ConsentCard customerId={customer.id} />,
    },
    {
      key: "groups",
      label: t("customers.groupsCard.title"),
      content: <CustomerGroupsCard customerId={customer.id} />,
    },
    {
      key: "privacy",
      label: t("customers.privacy.title"),
      content: <PrivacyRequestsCard customerId={customer.id} />,
    },
    // Store credit is for members: a guest cannot sign in to spend it
    ...(storeCredit && customer.has_account
      ? [
          {
            key: "credit",
            label: t("storeCredit.title"),
            content: <StoreCreditCard customerId={customer.id} />,
          },
        ]
      : []),
  ]
  return <PageTabs tabs={tabs} label={t("customers.detail.tabs.label")} />
}

/**
 * One customer (docs/06 "Detay sayfası düzeni"): how to reach and bill
 * them in one card at the top, then their orders, what they were sent,
 * their message permissions, groups, KVKK requests and store credit, one
 * tab each.
 */
export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const query = useQuery(customerQuery(id))
  const customer = query.data
  const back = { to: "/customers", label: t("nav.customers") }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("customers.detail.title")} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  if (!customer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-60 rounded-lg" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customerName(customer) ?? customer.email}
        description={
          customer.created_at
            ? t("customers.detail.since", { date: formatDate(customer.created_at) })
            : undefined
        }
        badge={
          <StatusBadge tone={customer.has_account ? "info" : "neutral"}>
            {t(customer.has_account ? "customers.kind.registered" : "customers.kind.guest")}
          </StatusBadge>
        }
        back={back}
      />
      <CustomerInfoCard customer={customer} />
      <CustomerTabs customer={customer} />
    </div>
  )
}
