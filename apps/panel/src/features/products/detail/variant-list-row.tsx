import { ChevronDown, ImageOff } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { VariantFacts } from "./variant-facts"

const D = "products.variant"

/** The list's columns, the head's and every row's: picture, name, price, stock, notes. */
export const VARIANT_COLUMNS =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_8rem_7.5rem_minmax(0,9.5rem)_1rem]"

/** Untracked stock is always sold (platform rule): said in the stock's place. */
function StockText({ stock }: { stock: number | null }) {
  const { t } = useTranslation()
  return stock === null ? (
    <span className="text-xs text-muted-foreground">{t(`${D}.untrackedShort`)}</span>
  ) : (
    <>{formatCount(stock)}</>
  )
}

/**
 * One variant in the product's list (the owner, 2026-11-25: WooCommerce's
 * variations, no dialog): a box to pick it for a bulk change, then its
 * picture, option values and stock code, price (struck through when the
 * storefront shows a discount), stock and up to two notes. The row opens
 * in place (`children`, the variant's form); Enter or a click toggles it.
 */
export function VariantListRow({
  facts,
  disabled,
  open,
  selected,
  onSelect,
  onToggle,
  children,
}: {
  facts: VariantFacts
  disabled: boolean
  open: boolean
  selected: boolean
  onSelect: (selected: boolean) => void
  onToggle: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const hints = facts.hints.map((hint) => (
    <StatusBadge key={hint.key} tone={hint.tone}>
      {t(`${D}.hints.${hint.key}`)}
    </StatusBadge>
  ))
  return (
    <li data-variant-item="" className={cn(open && "bg-muted/20")}>
      <div className="flex items-center pl-5">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => {
            onSelect(checked === true)
          }}
          aria-label={t(`${D}.bulk.pick`, { name: facts.name })}
        />
        <button
          type="button"
          data-variant-row=""
          disabled={disabled}
          aria-expanded={open}
          onClick={onToggle}
          className={`${VARIANT_COLUMNS} min-w-0 flex-1 py-2.5 pr-5 pl-3 text-left text-[13px] outline-hidden transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-progress`}
        >
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
            {facts.thumb ? (
              <img src={facts.thumb} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <ImageOff className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{facts.name}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              {facts.sku.trim() || t(`${D}.noSku`)}
            </span>
            {/* A phone: the notes under the name, the price and stock on the right */}
            {hints.length > 0 ? (
              <span className="mt-1 flex flex-wrap gap-1 sm:hidden">{hints}</span>
            ) : null}
          </span>
          <span className="flex flex-col items-end gap-0.5 tabular-nums sm:items-start">
            {facts.price === null ? (
              <span className="text-warning-text">—</span>
            ) : (
              // What the storefront shows: today's price, and the one struck through beside it
              <span className="font-medium">
                {formatMoney(facts.sale?.price ?? facts.price, "try")}
              </span>
            )}
            {facts.sale ? (
              <s className="text-xs text-muted-foreground">
                {formatMoney(facts.sale.struck, "try")}
              </s>
            ) : null}
            {/* A phone: the stock under the price */}
            <span className="text-xs text-muted-foreground sm:hidden">
              {facts.stock === null
                ? t(`${D}.untrackedShort`)
                : t(`${D}.stockCount`, { count: facts.stock, formatted: formatCount(facts.stock) })}
            </span>
          </span>
          <span className="hidden tabular-nums sm:block">
            <StockText stock={facts.stock} />
          </span>
          <span className="hidden min-w-0 flex-wrap justify-end gap-1 sm:flex">{hints}</span>
          <ChevronDown
            className={cn(
              "hidden size-4 text-muted-foreground transition-transform sm:block",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      {open ? children : null}
    </li>
  )
}
