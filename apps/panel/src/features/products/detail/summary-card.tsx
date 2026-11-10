import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { interestQuery } from "@/features/products/api/interest"
import type { ProductDetail } from "@/features/products/api/products"
import { availableStock, priceRange } from "@/features/products/product-math"
import { formatCount, formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const I = "products.interest"

const LIST = "grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2"

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right tabular-nums", strong && "text-sm font-semibold")}>{value}</dd>
    </div>
  )
}

/**
 * The product at a glance, in the page's narrow column (docs/06 "Ürün
 * sayfası"): its price span and sellable stock, how many keep it and
 * wait for it (F10.4–F10.5, counts only, so the shop knows what to
 * restock first), and when it was added and last changed. The pictures
 * and the prices themselves are in the main column.
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
  const date = (value: ProductDetail["created_at"]) => (value ? formatDateTime(value) : "—")
  return (
    <SectionCard title={t("products.detail.summary")}>
      <div className="flex flex-col gap-3 text-[13px]">
        <dl className={LIST}>
          <Row label={t("products.columns.price")} value={price} strong />
          <Row
            label={t("products.detail.available")}
            value={stock === null ? t("products.untracked") : formatCount(stock)}
          />
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
        <dl className={cn(LIST, "border-t pt-3")}>
          <Row label={t("products.detail.created")} value={date(product.created_at)} />
          <Row label={t("products.columns.updated")} value={date(product.updated_at)} />
        </dl>
      </div>
    </SectionCard>
  )
}
