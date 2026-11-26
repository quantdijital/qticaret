import { ListFilter, X } from "lucide-react"
import type { ReactNode } from "react"
import { useRef, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet"
import { formatDate } from "../lib/format"
import { cn } from "../lib/utils"
import type { DayRange } from "./day-range-filter"
import { FilterList, FilterPane } from "./filter-bar-parts"
import type { FilterDef, FilterValue, FilterValues } from "./filter-bar-model"
import { isActive, summaryOf } from "./filter-bar-model"

export type {
  CustomFilter,
  DaysFilter,
  FilterDef,
  FilterOption,
  FilterValue,
  FilterValues,
  MultiFilter,
  NumberFilter,
  SingleFilter,
} from "./filter-bar-model"

// A phone, a tablet's width or a finger: the menu opens from the bottom edge
const SHEET_QUERY = "(max-width: 767px), (pointer: coarse)"

const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") {
    return () => undefined
  }
  const media = window.matchMedia(SHEET_QUERY)
  media.addEventListener("change", onChange)
  return () => {
    media.removeEventListener("change", onChange)
  }
}
const sheetNow = () =>
  typeof window.matchMedia === "function" && window.matchMedia(SHEET_QUERY).matches

interface FilterBarProps {
  filters: readonly FilterDef[]
  values: FilterValues
  /** One filter set or cleared (`undefined`); the page writes it into its address. */
  onChange: (key: string, value: FilterValue) => void
  /** Every filter cleared at once. */
  onClear: () => void
  /** The list's search box, first in the row. */
  search?: ReactNode
  /** Controls after the filter button (an order, an export, a wholesaler). */
  actions?: ReactNode
  /** A line under the chips (the list read only its newest records). */
  note?: ReactNode
  className?: string
  /**
   * Places the bar's two parts itself (a list without a search: the button
   * at the end of its FilterTabs, the chips under them). `chips` is `null`
   * while no filter is set; `search`, `actions`, `note` and `className`
   * are not used then.
   */
  layout?: (parts: { trigger: ReactNode; chips: ReactNode }) => ReactNode
  /** The button shows only its icon on a phone; its name stays for a screen reader. */
  compact?: boolean
}

/**
 * A list's filters (docs/18 §7, "Filtre çubuğu"): one row of the search,
 * a "Filtrele" button with how many filters are set, and the list's own
 * controls; the button opens a menu of the filters, each with its choices
 * (a popover; a sheet from the bottom on a phone or a touch screen). What
 * is set shows under the row as chips: a chip opens its filter, its ×
 * clears it, "Tümünü temizle" clears them all.
 */
export function FilterBar({
  filters,
  values,
  onChange,
  onClear,
  search,
  actions,
  note,
  className,
  layout,
  compact = false,
}: FilterBarProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const asSheet = useSyncExternalStore(subscribe, sheetNow, () => false)
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  // The filter whose choices are shown; none: the list of filters
  const [view, setView] = useState<string | null>(null)
  const days = (range: DayRange) =>
    t("list.days.range", {
      from: range.from ? formatDate(range.from) : "…",
      to: range.to ? formatDate(range.to) : "…",
    })
  const summaries = new Map(
    filters.map((filter) => [filter.key, summaryOf(filter, values[filter.key], days)] as const)
  )
  const set = filters.filter((filter) => isActive(filter, values[filter.key]))
  const shown = filters.find((filter) => filter.key === view)
  const openAt = (key: string | null) => {
    setView(key)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
  }
  const menu = shown ? (
    // Keyed: a typed number or days start again from the value when another filter opens
    <FilterPane
      key={shown.key}
      filter={shown}
      value={values[shown.key]}
      active={isActive(shown, values[shown.key])}
      onBack={() => {
        setView(null)
      }}
      onChange={(next) => {
        onChange(shown.key, next)
      }}
      onClose={close}
    />
  ) : (
    <FilterList filters={filters} summaries={summaries} onOpen={setView} />
  )
  const label = set.length > 0 ? t("filterBar.count", { count: set.length }) : t("filterBar.filter")
  const trigger = (
    <Button
      ref={button}
      variant="outline"
      className={cn("shrink-0", set.length > 0 && "border-primary/40")}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        if (open) {
          close()
        } else {
          openAt(null)
        }
      }}
    >
      <ListFilter aria-hidden="true" />
      {compact ? <span className="max-sm:sr-only">{label}</span> : label}
    </Button>
  )

  const control = asSheet ? (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-lg pb-6">
          <SheetHeader className="pb-3">
            <SheetTitle>{t("filterBar.filter")}</SheetTitle>
            <SheetDescription className="sr-only">{t("filterBar.description")}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 overflow-y-auto px-4" data-scroll-area="y">
            {menu}
          </div>
        </SheetContent>
      </Sheet>
    </>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>{trigger}</PopoverAnchor>
      <PopoverContent
        // At a row's end the menu opens leftwards, inside the page
        align={layout ? "end" : "start"}
        className="w-80 p-1.5"
        aria-label={t("filterBar.filter")}
        onInteractOutside={(event) => {
          // The button toggles the menu itself: a press on it is not a click away
          if (button.current?.contains(event.target as Node)) {
            event.preventDefault()
          }
        }}
      >
        {menu}
      </PopoverContent>
    </Popover>
  )
  const chips =
    set.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2" data-filter-chips="">
        {set.map((filter) => (
          <span
            key={filter.key}
            className="flex h-7 max-w-full items-center rounded-full border bg-muted/60 text-xs"
          >
            <button
              type="button"
              className="min-w-0 truncate rounded-l-full py-1 pr-1 pl-3 hover:text-foreground"
              onClick={() => {
                openAt(filter.key)
              }}
            >
              <span className="text-muted-foreground">{filter.label}:</span>{" "}
              <span className="font-medium">{summaries.get(filter.key)}</span>
            </button>
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-r-full text-muted-foreground hover:text-foreground"
              aria-label={t("filterBar.remove", { name: filter.label })}
              onClick={() => {
                onChange(filter.key, undefined)
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={onClear}>
          {t("filterBar.clearAll")}
        </Button>
      </div>
    ) : null

  if (layout) {
    return <>{layout({ trigger: control, chips })}</>
  }

  return (
    <div className={cn("flex flex-col gap-2", className)} data-filter-bar="">
      <div className="flex flex-wrap items-center gap-2">
        {/* The search never shrinks below a readable width (the owner 2026-11-26: the
            products' search squeezed to one word beside its sort and view buttons): the
            list's controls take the next line first */}
        {search ? <div className="min-w-0 flex-[1_1_12rem] sm:max-w-80">{search}</div> : null}
        {control}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>
        ) : null}
      </div>
      {chips}
      {note}
    </div>
  )
}
