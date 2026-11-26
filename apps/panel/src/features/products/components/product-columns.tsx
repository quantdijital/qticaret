import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { isGiftCardProduct } from "@/features/products/api/products"
import type { ProductListItem } from "@/features/products/api/products"
import { ProductRowMenu } from "@/features/products/components/product-row-menu"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { availableStock, listSku, priceRange } from "@/features/products/product-math"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { QuickPrice, QuickStatusCell, QuickStock } from "@/features/products/quick-edit/quick-cells"
import type { QuickEdit } from "@/features/products/quick-edit/use-quick-edit"
import type { StoredAssessment } from "@/features/seo/api/advisor"
import { GRADE_TEXT } from "@/features/seo/advisor/grades"
import { formatCount, formatMoney, formatRelative } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const CURRENCY = "try"
// docs/18: low stock reads amber from here down (adr/0020 brings per-item thresholds)
const LOW_STOCK = 5

/**
 * The product list's columns: picture and name (the stock code under it),
 * status, stock, variants, category, SEO, price, and the row's ⋯ menu.
 */
export function useProductColumns(
  scores: ReadonlyMap<string, StoredAssessment>,
  onDuplicate: (product: ProductListItem) => void,
  /** The columns the person turned off in "Görünüm" (`list-prefs.ts`). */
  hidden: readonly string[] = [],
  /** "Hızlı düzenle": while on, price, stock and status are fields (`quick-edit/`). */
  quick?: QuickEdit
): Column<ProductListItem>[] {
  const { t } = useTranslation()
  const prefix = useProductPathPrefix()
  const columns: Column<ProductListItem>[] = [
    {
      key: "product",
      header: t("products.columns.product"),
      // A long name is cut short (whole on hover) instead of pushing the other columns off the card
      fill: true,
      className: "min-w-40",
      cell: (product) => {
        const sku = listSku(product.variants)
        return (
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb src={product.thumbnail} />
            <div className="flex min-w-0 flex-col">
              <Link
                to="/products/$id"
                params={{ id: product.id }}
                title={product.title}
                className="truncate font-medium hover:underline"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                {product.title}
              </Link>
              <span className="truncate text-xs text-muted-foreground">
                {sku ? (
                  <span className="text-foreground/80" title={t("products.columns.sku")}>
                    {sku.sku}
                    {sku.more > 0 ? ` +${String(sku.more)}` : ""}
                    {" · "}
                  </span>
                ) : null}
                {prefix}
                {product.handle}
              </span>
            </div>
          </div>
        )
      },
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
  const shown = columns.filter((column) => !hidden.includes(column.key))
  return quick?.on ? withQuickEdit(shown, quick) : shown
}

// The quick edit's fields in the price, stock and status cells; what they show otherwise falls back
const QUICK_CELLS = { price: QuickPrice, stock: QuickStock, status: QuickStatusCell } as const

function withQuickEdit(
  columns: Column<ProductListItem>[],
  edit: QuickEdit
): Column<ProductListItem>[] {
  return columns.map((column) => {
    const Cell = QUICK_CELLS[column.key as keyof typeof QUICK_CELLS] as
      (typeof QUICK_CELLS)[keyof typeof QUICK_CELLS] | undefined
    if (!Cell) {
      return column
    }
    return {
      ...column,
      cell: (product) => <Cell product={product} edit={edit} fallback={column.cell(product)} />,
    }
  })
}
