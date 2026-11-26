import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { customerStatsQuery } from "@/features/customers/api/customers"
import { CustomerFigures } from "@/features/customers/components/customer-figures"

/**
 * The customer's numbers at the top of their page (CU1): orders, what they
 * came to, the average basket, the last order and the city, one strip.
 * Nothing on failure: the page's own cards say what went wrong.
 */
export function CustomerStatsCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const query = useQuery(customerStatsQuery([customerId]))
  const stats = query.data?.stats[0]
  if (query.isError) {
    return null
  }
  return (
    <section
      aria-label={t("customers.stats.title")}
      className="rounded-lg border bg-card px-5 py-4 text-card-foreground shadow-card"
    >
      {stats && query.data ? (
        <CustomerFigures
          stats={stats}
          currency={query.data.currency_code}
          figures={["orders", "spent", "average", "lastOrder", "city"]}
          className="sm:grid-cols-5"
        />
      ) : (
        <Skeleton className="h-10" />
      )}
    </section>
  )
}
