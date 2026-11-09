import { ChevronDown, Loader2, Pencil } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MAX_BULK_PRODUCTS, matchingProductIds } from "@/features/products/api/bulk"
import type { BulkAction } from "@/features/products/api/bulk"
import type { ProductFilters } from "@/features/products/api/products"
import { useCan } from "@/features/auth/api/staff"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

const CATALOG_ACTIONS = ["price", "cost", "stock", "status", "category"] as const
const SEO_ACTIONS = ["seo_template", "alt_text"] as const

interface BulkBarProps {
  selected: ReadonlySet<string>
  onSelect: (ids: Set<string>) => void
  /** The list's search and view, for "select all that match". */
  filters: ProductFilters
  /** How many products the list holds. */
  total: number
  onAction: (action: BulkAction) => void
  /** Bringing the facts in the picked products' descriptions over (adr/0013 Ek 2026-11-05). */
  onFacts: () => void
}

/**
 * Above the list while products are picked (F3.10): how many, picking
 * every one the search holds (up to the limit a run takes), letting go,
 * and the changes that can be made to them at once.
 */
export function BulkBar({ selected, onSelect, filters, total, onAction, onFacts }: BulkBarProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const canEdit = useCan("catalog")
  // Picked one by one across pages, past what a run takes
  const tooMany = selected.size > MAX_BULK_PRODUCTS
  const selectAll = async () => {
    setLoading(true)
    try {
      const { ids, count } = await matchingProductIds(filters)
      if (count > MAX_BULK_PRODUCTS) {
        toast.error(t("products.bulk.tooMany", { max: formatCount(MAX_BULK_PRODUCTS) }))
        return
      }
      onSelect(new Set(ids))
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setLoading(false)
    }
  }
  const item = (action: BulkAction) => (
    <DropdownMenuItem
      key={action}
      onSelect={() => {
        onAction(action)
      }}
    >
      {t(`products.bulk.actions.${action}`)}
    </DropdownMenuItem>
  )
  return (
    <div
      role="region"
      aria-label={t("products.bulk.region")}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/60 px-5 py-2.5 text-sm"
    >
      <span className="font-medium" aria-live="polite">
        {t("products.bulk.selected", {
          count: selected.size,
          formatted: formatCount(selected.size),
        })}
      </span>
      {total > selected.size ? (
        <Button
          variant="link"
          // The shop's own brand colour may be too light on the bar: links read in text colour
          className="h-auto p-0 text-foreground underline"
          disabled={loading}
          onClick={() => void selectAll()}
        >
          {loading ? <Loader2 className="animate-spin" /> : null}
          {t("products.bulk.selectAll", { count: total, formatted: formatCount(total) })}
        </Button>
      ) : null}
      <Button
        variant="link"
        className="h-auto p-0 text-foreground underline"
        onClick={() => {
          onSelect(new Set())
        }}
      >
        {t("products.bulk.clear")}
      </Button>
      {tooMany ? (
        <span className="text-warning-text">
          {t("products.bulk.tooMany", { max: formatCount(MAX_BULK_PRODUCTS) })}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="ml-auto" disabled={tooMany}>
            <Pencil />
            {t("products.bulk.edit")}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {CATALOG_ACTIONS.map(item)}
          <DropdownMenuSeparator />
          {SEO_ACTIONS.map(item)}
          {canEdit ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onFacts}>{t("attributes.facts.action")}</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
