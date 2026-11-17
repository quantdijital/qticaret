import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageTabs } from "@qticaret/admin-ui/patterns/page-tabs"
import type { PageTab } from "@qticaret/admin-ui/patterns/page-tabs"
import { messageHistoryQuery } from "@/features/customers/api/messages"
import { MessageHistoryCard } from "@/features/customers/components/message-history-card"
import { chargebacksQuery } from "@/features/orders/api/chargebacks"
import type { ShopRefund } from "@/features/orders/api/payments"
import { ChargebacksCard } from "./chargebacks-card"
import { ContractsCard } from "./contracts-card"
import { RefundsCard } from "./refunds-card"
import { NoReturnsRow } from "./returns-card"

const T = "orders.detailTabs"

/**
 * What an order's page holds under its main cards (docs/06 "Detay sayfası
 * düzeni"), one card per tab: what the customer was sent, the "İade yok"
 * row (a request is a full card at the top instead), the money given
 * back, the disputes and the contracts the shopper accepted. A tab with
 * nothing to show and nothing to do is left out.
 */
export function OrderTabs({
  orderId,
  currency,
  refunds,
  hasReturns,
}: {
  orderId: string
  currency: string
  refunds: readonly ShopRefund[]
  /** A return or exchange exists (its card is at the top of the page); undefined until read. */
  hasReturns: boolean | undefined
}) {
  const { t } = useTranslation()
  const messages = useQuery(messageHistoryQuery({ orderId }))
  const chargebacks = useQuery(chargebacksQuery({ order_id: orderId })).data?.chargebacks ?? []
  const tabs: PageTab[] = [
    {
      key: "messages",
      label: t(`${T}.messages`),
      count: messages.data?.messages.length,
      content: <MessageHistoryCard orderId={orderId} />,
    },
    ...(hasReturns !== false
      ? []
      : [
          { key: "returns", label: t(`${T}.returns`), content: <NoReturnsRow orderId={orderId} /> },
        ]),
    ...(refunds.length > 0
      ? [
          {
            key: "refunds",
            label: t(`${T}.refunds`),
            count: refunds.length,
            content: <RefundsCard orderId={orderId} refunds={[...refunds]} currency={currency} />,
          },
        ]
      : []),
    ...(chargebacks.length > 0
      ? [
          {
            key: "chargebacks",
            label: t(`${T}.chargebacks`),
            count: chargebacks.length,
            content: <ChargebacksCard chargebacks={chargebacks} />,
          },
        ]
      : []),
    { key: "contracts", label: t(`${T}.contracts`), content: <ContractsCard orderId={orderId} /> },
  ]
  return <PageTabs tabs={tabs} label={t(`${T}.label`)} />
}
