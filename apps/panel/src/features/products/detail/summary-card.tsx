import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { availableStock, priceRange } from "@/features/products/product-math"
import { formatCount, formatDateTime, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

/** The product at a glance: picture, price span, sellable stock, dates. */
export function SummaryCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const range = priceRange(product.variants, "try")
  const stock = availableStock(product.variants)
  const price = range
    ? range.min === range.max
      ? formatMoney(range.min, "try")
      : `${formatMoney(range.min, "try")} – ${formatMoney(range.max, "try")}`
    : "—"
  return (
    <SectionCard title={t("products.detail.summary")}>
      <div className="flex flex-col gap-4">
        <ProductThumb
          src={product.thumbnail}
          className={cn(
            "size-auto w-full rounded-lg [&_svg]:size-8",
            product.thumbnail ? "aspect-square" : "aspect-[5/2]"
          )}
        />
        <dl className="flex flex-col divide-y">
          <Row label={t("products.columns.price")} value={price} />
          <Row
            label={t("products.detail.available")}
            value={stock === null ? t("products.untracked") : formatCount(stock)}
          />
          <Row
            label={t("products.columns.variants")}
            value={formatCount(product.variants?.length ?? 0)}
          />
          <Row
            label={t("products.detail.created")}
            value={product.created_at ? formatDateTime(product.created_at) : "—"}
          />
          <Row
            label={t("products.columns.updated")}
            value={product.updated_at ? formatDateTime(product.updated_at) : "—"}
          />
        </dl>
      </div>
    </SectionCard>
  )
}
