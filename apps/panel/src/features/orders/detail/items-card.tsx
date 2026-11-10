import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import type { OrderDetail, OrderMoney, OrderMoneyLine } from "@/features/orders/api/orders"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { AddonLineDetails } from "./addon-line"
import { GiftLineDetails } from "./gift-line"
import { formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  // A <dl> holds its <div> groups directly: the total's rule is on its own row
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        strong ? "mt-1 border-t pt-3 text-base font-semibold" : "text-sm"
      )}
    >
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

type Item = OrderDetail["items"][number]

/** One line: what it is, how many at what price, what it was paid and its discount share. */
function ItemRow({
  item,
  line,
  currency,
  money,
}: {
  item: Item
  line: OrderMoneyLine | undefined
  currency: string
  money: (amount: string | number | null | undefined) => string
}) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-4 border-t px-5 py-3.5">
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
        <GiftLineDetails metadata={item.metadata} />
        <AddonLineDetails metadata={item.metadata} currency={currency} />
      </div>
      <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">
        {formatCount(item.quantity)} × {money(item.unit_price)}
      </span>
      <div className="flex w-32 flex-col items-end gap-0.5 text-right">
        <span className="text-sm font-medium tabular-nums">{money(line?.net ?? item.total)}</span>
        {line && Number(line.discount) > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("orders.detail.lineDiscount", { amount: money(line.discount) })}
          </span>
        ) : null}
        {line?.returned ? (
          <span className="text-xs text-muted-foreground">
            {t("orders.detail.returnedUnits", { count: line.returned })}
          </span>
        ) : null}
      </div>
    </li>
  )
}

/**
 * What was bought, at what price, and how the total adds up: prices with
 * KDV in, so items and shipping less the discount make the total. Lines
 * and totals come to the kuruş from the server (F4.7), as the order was
 * placed; until they arrive, Medusa's own totals.
 */
export function ItemsCard({ order, money: shares }: { order: OrderDetail; money?: OrderMoney }) {
  const { t } = useTranslation()
  const money = (amount: string | number | null | undefined) =>
    formatMoney(amount ?? 0, order.currency_code)
  const items = order.items
  const discount = shares?.discount ?? order.discount_total
  const shipping = order.shipping_methods[0]
  return (
    <SectionCard title={t("orders.detail.items", { count: items.length })} flush>
      <ul className="flex flex-col">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            line={shares?.lines.find((line) => line.id === item.id)}
            currency={order.currency_code}
            money={money}
          />
        ))}
      </ul>
      {/* At the foot of the card when it stretches beside a taller column */}
      <dl className="mt-auto flex flex-col gap-2 border-t bg-muted/30 px-5 py-4">
        <TotalRow
          label={t("orders.detail.subtotal")}
          value={money(shares?.items.gross ?? order.original_item_total)}
        />
        <TotalRow
          label={
            shipping?.name
              ? t("orders.detail.shippingNamed", { name: shipping.name })
              : t("orders.detail.shipping")
          }
          value={money(shares?.shipping.gross ?? order.original_shipping_total)}
        />
        {Number(discount) > 0 ? (
          <TotalRow label={t("orders.detail.discount")} value={`−${money(discount)}`} />
        ) : null}
        <TotalRow label={t("orders.detail.tax")} value={money(order.tax_total)} />
        <TotalRow
          label={t("orders.detail.total")}
          value={money(shares?.net ?? order.total)}
          strong
        />
      </dl>
    </SectionCard>
  )
}
