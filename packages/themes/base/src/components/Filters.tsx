import { Check } from "lucide-react"
import type { FilterGroupView, PriceFilterView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** Lists longer than this fold their rest behind "more", without a script. */
const SHOWN = 6

function FilterOption({ option }: { option: FilterGroupView["options"][number] }) {
  return (
    <a
      href={option.path}
      rel="nofollow"
      aria-current={option.selected ? "true" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg py-1.5 text-sm transition-colors hover:text-foreground",
        option.selected ? "font-medium text-foreground" : "text-foreground/80",
        option.count === 0 && !option.selected && "pointer-events-none opacity-45"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          option.selected
            ? "border-foreground bg-foreground text-background"
            : "border-input bg-card group-hover:border-foreground/50"
        )}
      >
        {option.selected && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="flex-1">{option.label}</span>
      <span className="tabular text-xs text-muted-foreground">{option.count}</span>
    </a>
  )
}

function FilterGroup({ group, more }: { group: FilterGroupView; more: string }) {
  const first = group.options.slice(0, SHOWN)
  const rest = group.options.slice(SHOWN)
  return (
    <details open className="group/filter border-b py-4 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold marker:hidden">
        {group.label}
        <span
          aria-hidden="true"
          className="text-lg leading-none text-muted-foreground transition-transform group-open/filter:rotate-45"
        >
          +
        </span>
      </summary>
      <ul className="mt-3 flex flex-col">
        {first.map((option) => (
          <li key={option.path}>
            <FilterOption option={option} />
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group/more">
          <summary className="mt-1 cursor-pointer list-none text-xs font-semibold text-primary marker:hidden group-open/more:hidden">
            {more.replace("{count}", String(rest.length))}
          </summary>
          <ul className="flex flex-col">
            {rest.map((option) => (
              <li key={option.path}>
                <FilterOption option={option} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </details>
  )
}

/** The price range: a plain GET form; the listing's other choices ride along hidden. */
function PriceForm({ price, t }: { price: PriceFilterView; t: Translate }) {
  return (
    <details open className="group/filter py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold marker:hidden">
        {t("listing.price")}
        <span
          aria-hidden="true"
          className="text-lg leading-none text-muted-foreground transition-transform group-open/filter:rotate-45"
        >
          +
        </span>
      </summary>
      <form action={price.action} method="get" className="mt-3 flex flex-col gap-3">
        {price.keep.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} />
        ))}
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="sr-only">{t("listing.price_min")}</span>
            <input
              type="number"
              name="fiyat_en_az"
              inputMode="numeric"
              min={0}
              placeholder={String(price.min)}
              defaultValue={price.currentMin ?? undefined}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm tabular outline-none focus-visible:border-foreground"
            />
          </label>
          <span aria-hidden="true" className="text-muted-foreground">
            –
          </span>
          <label className="flex-1">
            <span className="sr-only">{t("listing.price_max")}</span>
            <input
              type="number"
              name="fiyat_en_cok"
              inputMode="numeric"
              min={0}
              placeholder={String(price.max)}
              defaultValue={price.currentMax ?? undefined}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm tabular outline-none focus-visible:border-foreground"
            />
          </label>
        </div>
        <button
          type="submit"
          className="h-10 rounded-full border border-foreground text-sm font-semibold transition-colors hover:bg-foreground hover:text-background"
        >
          {t("listing.price_apply")}
        </button>
      </form>
    </details>
  )
}

/** Every filter the listing offers, then the price range. */
export function Filters({
  filters,
  price,
  t,
}: {
  filters: FilterGroupView[]
  price: PriceFilterView | null
  t: Translate
}) {
  return (
    <div className="flex flex-col">
      {filters.map((group) => (
        <FilterGroup key={group.key} group={group} more={t("listing.more_values")} />
      ))}
      {price && <PriceForm price={price} t={t} />}
    </div>
  )
}
