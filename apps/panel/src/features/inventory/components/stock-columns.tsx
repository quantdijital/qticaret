import { Link } from "@tanstack/react-router"
import { History } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Column } from "@/components/patterns/data-table"
import { NumberField } from "@/components/patterns/number-field"
import { Button } from "@/components/ui/button"
import type { StockItem } from "@/features/inventory/api/stock"
import { AvailableBadge } from "@/features/inventory/components/available-badge"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { formatCount } from "@/lib/format"
import { DIGITS } from "@/features/inventory/drafts"
import type { Drafts } from "@/features/inventory/drafts"
import { cn } from "@/lib/utils"

/** The stock list's columns; each item is judged by its own low-stock threshold. */
export function useStockColumns(
  locationId: string | null,
  drafts: Drafts,
  setDraft: (id: string, text: string) => void,
  onHistory: (item: StockItem) => void
): Column<StockItem>[] {
  const { t } = useTranslation()
  const shelf = (item: StockItem) => item.levels.find((level) => level.location_id === locationId)
  return [
    {
      key: "item",
      header: t("inventory.columns.item"),
      cell: (item) => {
        const product = item.variant?.product
        return (
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb src={product?.thumbnail} />
            {/* Capped on phones so long codes truncate instead of pushing the shelf field off screen */}
            <div className="flex max-w-[8.5rem] min-w-0 flex-col sm:max-w-xs">
              {product ? (
                <Link
                  to="/products/$id"
                  params={{ id: product.id }}
                  className="truncate font-medium hover:underline"
                >
                  {product.title}
                </Link>
              ) : (
                <span className="truncate font-medium">{item.title ?? "—"}</span>
              )}
              <span className="truncate text-xs text-muted-foreground">
                {[item.variant?.title, item.sku].filter(Boolean).join(" · ")}
              </span>
              {/* On phones sellable stock sits here; its own column comes back from sm up */}
              <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                {t("inventory.columns.available")}
                <AvailableBadge available={item.available} threshold={item.threshold} />
              </span>
            </div>
          </div>
        )
      },
    },
    {
      key: "available",
      header: t("inventory.columns.available"),
      className: "hidden sm:table-cell",
      cell: (item) => <AvailableBadge available={item.available} threshold={item.threshold} />,
    },
    {
      key: "reserved",
      header: t("inventory.columns.reserved"),
      align: "right",
      className: "hidden md:table-cell",
      cell: (item) => (
        <span className="text-muted-foreground tabular-nums">
          {formatCount(item.levels.reduce((sum, level) => sum + level.reserved_quantity, 0))}
        </span>
      ),
    },
    {
      key: "shelf",
      header: t("inventory.columns.shelf"),
      align: "right",
      cell: (item) => {
        const current = String(shelf(item)?.stocked_quantity ?? 0)
        const text = drafts[item.id] ?? current
        const invalid = !DIGITS.test(text)
        return (
          <NumberField
            size="compact"
            min={0}
            value={text}
            aria-label={t("inventory.shelfOf", {
              name: item.variant?.product?.title ?? item.sku ?? item.id,
            })}
            aria-invalid={invalid || undefined}
            className={cn(
              "ml-auto w-24 sm:w-28",
              drafts[item.id] !== undefined && drafts[item.id] !== current && "border-primary"
            )}
            onClick={(event) => {
              event.stopPropagation()
            }}
            onChange={(event) => {
              setDraft(item.id, event.target.value.trim())
            }}
          />
        )
      },
    },
    {
      key: "history",
      header: "",
      align: "right",
      cell: (item) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("inventory.history.open", {
            name: item.variant?.product?.title ?? item.sku ?? item.id,
          })}
          onClick={(event) => {
            event.stopPropagation()
            onHistory(item)
          }}
        >
          <History />
        </Button>
      ),
    },
  ]
}
