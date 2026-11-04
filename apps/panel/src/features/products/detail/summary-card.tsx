import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { interestQuery } from "@/features/products/api/interest"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { availableStock, priceRange } from "@/features/products/product-math"
import { formatCount, formatMoney } from "@/lib/format"

const I = "products.interest"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * The product at a glance: its picture beside the price span and sellable
 * stock, then how many keep it and wait for it (F10.4–F10.5, counts only,
 * so the shop knows what to restock first); its dates are in the page's
 * header. The gallery is the media card's; here the picture is only a
 * reminder.
 */
export function SummaryCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const interest = useQuery(interestQuery(product.id)).data
  const range = priceRange(product.variants, "try")
  const stock = availableStock(product.variants)
  const price = range
    ? range.min === range.max
      ? formatMoney(range.min, "try")
      : `${formatMoney(range.min, "try")} – ${formatMoney(range.max, "try")}`
    : "—"
  const waiting = interest?.stock_alerts ?? []
  return (
    <SectionCard title={t("products.detail.summary")}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <ProductThumb src={product.thumbnail} className="size-20 rounded-lg [&_svg]:size-6" />
          <dl className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-col">
              <dt className="text-[13px] text-muted-foreground">{t("products.columns.price")}</dt>
              <dd className="text-base font-semibold tabular-nums">{price}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-[13px] text-muted-foreground">
                {t("products.detail.available")}
              </dt>
              <dd className="text-sm font-medium tabular-nums">
                {stock === null ? t("products.untracked") : formatCount(stock)}
              </dd>
            </div>
          </dl>
        </div>
        <dl className="flex flex-col divide-y border-t">
          <Row
            label={t("products.columns.variants")}
            value={formatCount(product.variants?.length ?? 0)}
          />
          <Row label={t(`${I}.wishlist`)} value={interest ? formatCount(interest.wishlist) : "—"} />
          {waiting.length === 0 ? (
            <Row label={t(`${I}.waiting`)} value={interest ? formatCount(0) : "—"} />
          ) : (
            waiting.map((variant) => (
              <Row
                key={variant.variant_id}
                label={t(`${I}.waitingFor`, { variant: variant.title ?? "" })}
                value={formatCount(variant.waiting)}
              />
            ))
          )}
        </dl>
      </div>
    </SectionCard>
  )
}
