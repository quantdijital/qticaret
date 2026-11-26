import { ChevronDown, ImageOff } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { VariantFacts } from "./variant-facts"

const D = "products.variant"

/**
 * The list's columns, the head's and every row's, by the list's own width
 * (`@container/variants`: the card stands in a tab or a column): picture,
 * name, price, stock and the caret; narrow, the stock goes under the price.
 */
export const VARIANT_COLUMNS =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_auto_1rem] items-center gap-x-3 @lg/variants:grid-cols-[2.5rem_minmax(0,1fr)_7.5rem_5rem_1rem] @lg/variants:gap-x-4"

/**
 * The box picking a row for a bulk change. Its whole strip beside the row
 * is the target, as tall as the row: the box never stands beside the row
 * as a control of another height (docs/18 §2 "Denge").
 */
export function PickBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean | "indeterminate"
  onChange: (on: boolean) => void
  label: string
}) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center self-stretch pr-3 pl-5">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => {
          onChange(next === true)
        }}
        aria-label={label}
      />
    </label>
  )
}

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
 * picture, option values and stock code with up to two notes under them,
 * price (struck through when the storefront shows a discount), stock and
 * the caret. The row opens in place (`children`, the variant's form);
 * Enter or a click toggles it.
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
      <div className="flex items-stretch">
        <PickBox
          checked={selected}
          onChange={onSelect}
          label={t(`${D}.bulk.pick`, { name: facts.name })}
        />
        <button
          type="button"
          data-variant-row=""
          disabled={disabled}
          aria-expanded={open}
          onClick={onToggle}
          className={`${VARIANT_COLUMNS} min-w-0 flex-1 py-3 pr-5 text-left text-[13px] outline-hidden transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-progress`}
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
            {/* The code and the notes on one line under the name: the columns stay the price and the stock */}
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-mono text-xs text-muted-foreground">
                {facts.sku.trim() || t(`${D}.noSku`)}
              </span>
              {hints}
            </span>
          </span>
          <span className="flex flex-col items-end gap-0.5 tabular-nums @lg/variants:items-start">
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
            {/* Narrow: the stock under the price */}
            <span className="text-xs text-muted-foreground @lg/variants:hidden">
              {facts.stock === null
                ? t(`${D}.untrackedShort`)
                : t(`${D}.stockCount`, { count: facts.stock, formatted: formatCount(facts.stock) })}
            </span>
          </span>
          <span className="hidden tabular-nums @lg/variants:block">
            <StockText stock={facts.stock} />
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
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
