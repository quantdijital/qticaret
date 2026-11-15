import { Check, ChevronDown } from "lucide-react"
import type {
  FilterGroupView,
  FilterOptionView,
  ListingPageView,
  PriceFilterView,
  StockFilterView,
  Translate,
} from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { NumberInput } from "../parts/NumberInput"
import { roundStep, stepCeiling } from "../parts/number-step"
import { Swatch } from "../parts/Swatch"

/** Values a group shows before "+N daha göster" (a disclosure, no script). */
const SHOWN = 6

/** A filter link, with the sheet's anchor when it is drawn in the phone's sheet (it opens again there). */
export const anchored = (path: string, hash: string) => (hash ? `${path}#${hash}` : path)

const ROW =
  "flex min-h-11 items-center gap-3 rounded-inner px-2 text-sm no-underline transition-colors"

function Option({ option, hash }: { option: FilterOptionView; hash: string }) {
  const box = (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[min(6px,calc(6px*var(--radius-scale)))] border transition-colors",
        option.selected ? "border-text bg-text text-paper" : "border-edge bg-field"
      )}
    >
      {option.selected && <Check className="size-3.5" aria-hidden="true" strokeWidth={3} />}
    </span>
  )
  const body = (
    <>
      {box}
      {option.swatch && <Swatch hex={option.swatch} className="size-5" />}
      <span className="min-w-0 flex-1">{option.label}</span>
      <span className="tabular text-xs text-text-3">{option.count}</span>
    </>
  )
  // Nothing left to find with it: shown, never a link to an empty page
  if (option.count === 0 && !option.selected) {
    return (
      <span aria-disabled="true" className={cn(ROW, "text-text-3 opacity-60")}>
        {body}
      </span>
    )
  }
  return (
    <a
      href={anchored(option.path, hash)}
      rel="nofollow"
      aria-current={option.selected ? "true" : undefined}
      className={cn(ROW, option.selected ? "font-semibold" : "", "hover:bg-paper-3")}
    >
      {body}
    </a>
  )
}

function Group({ group, hash, t }: { group: FilterGroupView; hash: string; t: Translate }) {
  const first = group.options.slice(0, SHOWN)
  const rest = group.options.slice(SHOWN)
  const chosen = group.options.filter((option) => option.selected).length
  return (
    <details open className="group/filter rounded-media gf-box px-2 py-1">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-inner px-2 text-md font-semibold">
        <span>
          {group.label}
          {chosen > 0 && (
            <span className="tabular ml-2 text-sm font-semibold text-text-3">({chosen})</span>
          )}
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-text-3 transition-transform duration-(--dur-short) group-open/filter:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="flex flex-col pb-2">
        {first.map((option) => (
          <li key={option.path}>
            <Option option={option} hash={hash} />
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group/more pb-2">
          <summary className="gf-link px-2 text-sm group-open/more:hidden">
            {t("listing.more_values", { count: rest.length })}
          </summary>
          <ul className="flex flex-col">
            {rest.map((option) => (
              <li key={option.path}>
                <Option option={option} hash={hash} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </details>
  )
}

/** "Yalnızca stokta olanlar": a link drawn as a switch (no script), its count beside it. */
function StockSwitch({ stock, hash }: { stock: StockFilterView; hash: string }) {
  const dim = stock.count === 0 && !stock.selected
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-6 w-10 shrink-0 items-center rounded-pill p-0.5 transition-colors",
          stock.selected ? "bg-text" : "bg-paper-3"
        )}
      >
        <span
          className={cn(
            "size-5 rounded-pill bg-field transition-transform duration-(--dur-micro)",
            stock.selected && "translate-x-4"
          )}
        />
      </span>
      <span className="flex-1 font-semibold">{stock.label}</span>
      <span className="tabular text-xs text-text-3">{stock.count}</span>
    </>
  )
  const style = "flex min-h-14 items-center gap-3 rounded-media gf-box px-4 text-sm no-underline"
  return dim ? (
    <span aria-disabled="true" className={cn(style, "opacity-60")}>
      {body}
    </span>
  ) : (
    <a
      href={anchored(stock.path, hash)}
      rel="nofollow"
      aria-current={stock.selected ? "true" : undefined}
      className={cn(style, "transition-colors hover:bg-paper-3")}
    >
      {body}
    </a>
  )
}

/** The price range: a plain GET form; the listing's other choices ride along hidden. */
function PriceRange({
  price,
  id,
  hash,
  t,
}: {
  price: PriceFilterView
  id: string
  hash: string
  t: Translate
}) {
  // The chevrons move by a round share of the listing's range, never past its top
  const step = roundStep(price.min, price.max)
  const rule = { min: 0, max: stepCeiling(price.max, step), step }
  const words = { increase: t("listing.price_increase"), decrease: t("listing.price_decrease") }
  return (
    <details open className="group/filter rounded-media gf-box px-2 py-1">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-inner px-2 text-md font-semibold">
        {t("listing.price")}
        <ChevronDown
          className="size-5 shrink-0 text-text-3 transition-transform duration-(--dur-short) group-open/filter:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <form
        action={anchored(price.action, hash)}
        method="get"
        className="flex flex-col gap-3 px-2 pt-1 pb-3"
      >
        {price.keep.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} />
        ))}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <label htmlFor={`${id}-en-az`} className="sr-only">
            {t("listing.price_min")}
          </label>
          <NumberInput
            id={`${id}-en-az`}
            name="fiyat_en_az"
            rule={{ ...rule, start: price.min }}
            words={words}
            placeholder={`${t("listing.price_min")} ${String(price.min)}`}
            defaultValue={price.currentMin ?? undefined}
            className="px-4 text-md lg:text-sm"
          />
          <label htmlFor={`${id}-en-cok`} className="sr-only">
            {t("listing.price_max")}
          </label>
          <NumberInput
            id={`${id}-en-cok`}
            name="fiyat_en_cok"
            rule={{ ...rule, start: price.max }}
            words={words}
            placeholder={`${t("listing.price_max")} ${String(price.max)}`}
            defaultValue={price.currentMax ?? undefined}
            className="px-4 text-md lg:text-sm"
          />
        </div>
        <button type="submit" className="gf-btn gf-btn--quiet gf-btn--small w-full">
          {t("listing.price_apply")}
        </button>
      </form>
    </details>
  )
}

/**
 * Everything that narrows a listing, as filled wells (no hairlines): the
 * in-stock switch, each filter's values as rows of 44 px with their
 * counts (a value that would find nothing is shown but not a link), the
 * price range. Every choice is a plain link (nofollow) or a GET form, so
 * it works before the script; in the phone's sheet each carries the
 * sheet's anchor so the sheet opens again on the narrowed list.
 */
export function FilterPanel({
  view,
  t,
  id,
  hash = "",
}: {
  view: ListingPageView
  t: Translate
  /** Keeps the price fields' ids apart: the panel is drawn twice (side panel, sheet). */
  id: string
  hash?: string
}) {
  const stock = view.stock ?? null
  return (
    <div className="flex flex-col gap-2">
      {stock && <StockSwitch stock={stock} hash={hash} />}
      {view.filters.map((group) => (
        <Group key={group.key} group={group} hash={hash} t={t} />
      ))}
      {view.price && <PriceRange price={view.price} id={id} hash={hash} t={t} />}
    </div>
  )
}

/** Whether the listing offers anything to narrow it by. */
export const hasFilters = (view: ListingPageView) =>
  view.filters.length > 0 || view.price !== null || (view.stock ?? null) !== null
