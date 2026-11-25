import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { orderOriginQuery } from "@/features/orders/api/origin"
import type { OrderOrigin } from "@/features/orders/api/origin"

const O = "orders.origin"

/** The campaign words and the referring site, those the landing had, in a fixed order. */
const detailsOf = (origin: OrderOrigin): [string, string][] =>
  (
    [
      ["utmSource", origin.utm_source],
      ["utmMedium", origin.utm_medium],
      ["utmCampaign", origin.utm_campaign],
      ["referrer", origin.referrer_host],
    ] as const
  ).flatMap(([key, value]) => (value ? [[key, value] as [string, string]] : []))

/**
 * "Sipariş kaynağı" beside the order (O6): where its shopper first landed
 * from, as the storefront recorded the cart (the class the sales report
 * counts, the campaign's words, the referring site). Hidden when nothing
 * was recorded, while it loads and on failure: it is a side note.
 */
export function OriginCard({ orderId }: { orderId: string }) {
  const { t } = useTranslation()
  const { data: origin } = useQuery(orderOriginQuery(orderId))
  if (!origin) {
    return null
  }
  return (
    <SectionCard title={t(`${O}.title`)}>
      <dl className="flex flex-col gap-2 text-sm" data-testid="order-origin">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{t(`${O}.source`)}</dt>
          <dd className="text-right font-medium">
            {t(`reports.marketing.sources.names.${origin.source}`)}
          </dd>
        </div>
        {detailsOf(origin).map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{t(`${O}.${key}`)}</dt>
            <dd className="min-w-0 truncate text-right" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
