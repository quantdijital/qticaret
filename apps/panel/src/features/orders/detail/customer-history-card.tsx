import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { customerStatsQuery } from "@/features/customers/api/customers"
import { CustomerFigures } from "@/features/customers/components/customer-figures"

/**
 * "Müşteri geçmişi" beside the order (O4): how many orders the customer
 * has given, what they came to, their average basket and last order. Their
 * other orders are linked from the customer card above it, once. None for
 * an order without a customer record, nothing on failure.
 */
export function CustomerHistoryCard({ customerId }: { customerId: string | null | undefined }) {
  const { t } = useTranslation()
  const query = useQuery(customerStatsQuery(customerId ? [customerId] : []))
  const stats = query.data?.stats[0]
  if (!customerId || query.isError) {
    return null
  }
  return (
    <SectionCard title={t("orders.history.title")}>
      {stats && query.data ? (
        <CustomerFigures
          stats={stats}
          currency={query.data.currency_code}
          figures={["orders", "spent", "average", "lastOrder"]}
        />
      ) : (
        <Skeleton className="h-20" />
      )}
    </SectionCard>
  )
}
