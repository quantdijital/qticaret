import { Copy, EllipsisVertical } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ProductListItem } from "@/features/products/api/products"

/**
 * A row's ⋯ menu: copying the product (owner 2026-11-06). Clicks here
 * stay here: the row itself opens the product.
 */
export function ProductRowMenu({
  product,
  onDuplicate,
}: {
  product: ProductListItem
  onDuplicate: (product: ProductListItem) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("products.rowActions", { title: product.title })}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              onDuplicate(product)
            }}
          >
            <Copy />
            {t("products.duplicate.action")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
