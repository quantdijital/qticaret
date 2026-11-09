import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { Column } from "@/components/patterns/data-table"
import { Badge } from "@/components/ui/badge"
import { isGiftCardProduct } from "@/features/products/api/products"
import type { ProductListItem } from "@/features/products/api/products"
import { ProductRowMenu } from "@/features/products/components/product-row-menu"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { availableStock, priceRange } from "@/features/products/product-math"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import type { StoredAssessment } from "@/features/seo/api/advisor"
import { GRADE_TEXT } from "@/features/seo/advisor/grades"
import { formatCount, formatMoney, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const CURRENCY = "try"
// docs/18: low stock reads amber from here down (adr/0020 brings per-item thresholds)
const LOW_STOCK = 5

/**
 * The product list's columns: picture and name, status, stock, variants,
 * category, SEO, price, and the row's ⋯ menu (copying it).
 */
export function useProductColumns(
  scores: ReadonlyMap<string, StoredAssessment>,
  onDuplicate: (product: ProductListItem) => void
): Column<ProductListItem>[] {
  const { t } = useTranslation()
  const prefix = useProductPathPrefix()
  return [
    {
      key: "product",
      header: t("products.columns.product"),
      cell: (product) => (
        <div className="flex min-w-0 items-center gap-3">
          <ProductThumb src={product.thumbnail} />
          <div className="flex min-w-0 flex-col">
            <Link
              to="/products/$id"
              params={{ id: product.id }}
              className="truncate font-medium hover:underline"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              {product.title}
            </Link>
            <span className="truncate text-xs text-muted-foreground">
              {prefix}
              {product.handle}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: t("products.columns.status"),
      cell: (product) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ProductStatusBadge status={product.status} />
          {isGiftCardProduct(product) ? (
            <Badge variant="outline" className="h-6 font-normal">
              {t("products.giftCardBadge")}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "stock",
      header: t("products.columns.stock"),
      className: "hidden md:table-cell",
      cell: (product) => {
        const stock = availableStock(product.variants)
        return stock === null ? (
          <span className="text-muted-foreground">{t("products.untracked")}</span>
        ) : (
          <span className={cn("tabular", stock <= LOW_STOCK && "font-medium text-warning-text")}>
            {t("products.inStock", { count: stock, formatted: formatCount(stock) })}
          </span>
        )
      },
    },
    {
      key: "variants",
      header: t("products.columns.variants"),
      className: "hidden lg:table-cell",
      cell: (product) => (
        <span className="tabular text-muted-foreground">
          {formatCount(product.variants?.length ?? 0)}
        </span>
      ),
    },
    {
      key: "category",
      header: t("products.columns.category"),
      className: "hidden xl:table-cell",
      cell: (product) => {
        const names = (product.categories ?? []).map((category) => category.name)
        return names.length ? (
          <span className="text-muted-foreground">
            {names[0]}
            {names.length > 1 ? ` +${String(names.length - 1)}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      key: "updated",
      header: t("products.columns.updated"),
      className: "hidden xl:table-cell",
      cell: (product) => (
        <span className="text-muted-foreground">{formatRelative(product.updated_at ?? "")}</span>
      ),
    },
    {
      key: "seo",
      header: t("seo.advisor.column"),
      align: "right",
      className: "hidden lg:table-cell",
      cell: (product) => {
        const score = scores.get(product.id)
        return score ? (
          <span
            className={cn("font-semibold tabular-nums", GRADE_TEXT[score.grade])}
            title={t(`seo.advisor.grades.${score.grade}`)}
          >
            {score.score}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      key: "price",
      header: t("products.columns.price"),
      align: "right",
      cell: (product) => {
        const range = priceRange(product.variants, CURRENCY)
        if (!range) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <span className="tabular font-medium">
            {formatMoney(range.min, CURRENCY)}
            {range.max > range.min ? ` – ${formatMoney(range.max, CURRENCY)}` : ""}
          </span>
        )
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("products.columns.actions")}</span>,
      align: "right",
      className: "w-12",
      cell: (product) => <ProductRowMenu product={product} onDuplicate={onDuplicate} />,
    },
  ]
}
