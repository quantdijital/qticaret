import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { customerStatsQuery } from "@/features/customers/api/customers"
import { CustomerFigures } from "@/features/customers/components/customer-figures"

const H = "orders.history"

/**
 * "Müşteri geçmişi" beside the order (O4): how many orders the customer
 * has given, what they came to and their average basket, with all of
 * their orders a click away (the order list filtered to them). None for
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
    <SectionCard
      title={t(`${H}.title`)}
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/orders" search={{ customer: customerId }}>
            {t(`${H}.allOrders`)}
          </Link>
        </Button>
      }
    >
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
