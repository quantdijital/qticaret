import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import type { OrderDetail } from "@/features/orders/api/orders"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { formatCount, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        strong ? "text-base font-semibold" : "text-sm"
      )}
    >
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

/** What was bought, at what price, and how the total adds up (prices include KDV). */
export function ItemsCard({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const money = (amount: number | null | undefined) => formatMoney(amount ?? 0, order.currency_code)
  const items = order.items
  const shipping = order.shipping_methods[0]
  return (
    <SectionCard title={t("orders.detail.items", { count: items.length })} flush>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 border-t px-5 py-3.5">
            <ProductThumb src={item.thumbnail} className="size-12" />
            <div className="flex min-w-0 flex-1 flex-col">
              {item.product_id ? (
                <Link
                  to="/products/$id"
                  params={{ id: item.product_id }}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="truncate text-sm font-medium">{item.title}</span>
              )}
              <span className="truncate text-xs text-muted-foreground">
                {[item.subtitle, item.variant_sku].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">
              {formatCount(item.quantity)} × {money(item.unit_price)}
            </span>
            <span className="w-28 text-right text-sm font-medium tabular-nums">
              {money(item.total)}
            </span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 border-t bg-muted/30 px-5 py-4">
        <TotalRow label={t("orders.detail.subtotal")} value={money(order.subtotal)} />
        <TotalRow
          label={
            shipping?.name
              ? t("orders.detail.shippingNamed", { name: shipping.name })
              : t("orders.detail.shipping")
          }
          value={money(order.shipping_total)}
        />
        {order.discount_total ? (
          <TotalRow label={t("orders.detail.discount")} value={`−${money(order.discount_total)}`} />
        ) : null}
        <TotalRow label={t("orders.detail.tax")} value={money(order.tax_total)} />
        <div className="mt-1 border-t pt-3">
          <TotalRow label={t("orders.detail.total")} value={money(order.total)} strong />
        </div>
      </dl>
    </SectionCard>
  )
}
