import { queryOptions, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import { sdk } from "@/lib/sdk"

interface Interest {
  wishlist: number
  stock_alerts: { variant_id: string; title: string | null; waiting: number }[]
}

const I = "products.interest"

const interestQuery = (productId: string) =>
  queryOptions({
    queryKey: ["products", productId, "interest"],
    queryFn: () =>
      sdk.client.fetch<Interest>(`/admin/products/${encodeURIComponent(productId)}/interest`),
  })

/**
 * How many customers keep the product and wait for it to come back
 * (F10.4–F10.5): counts only, so the shop knows what to restock first.
 */
export function InterestCard({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const query = useQuery(interestQuery(productId))
  const data = query.data
  return (
    <SectionCard title={t(`${I}.title`)}>
      {!data ? (
        <Skeleton className="h-12" />
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t(`${I}.wishlist`)}</dt>
            <dd className="tabular-nums">{data.wishlist}</dd>
          </div>
          {data.stock_alerts.length === 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t(`${I}.waiting`)}</dt>
              <dd className="tabular-nums">0</dd>
            </div>
          ) : (
            data.stock_alerts.map((variant) => (
              <div key={variant.variant_id} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {t(`${I}.waitingFor`, { variant: variant.title ?? "" })}
                </dt>
                <dd className="tabular-nums">{variant.waiting}</dd>
              </div>
            ))
          )}
        </dl>
      )}
    </SectionCard>
  )
}
