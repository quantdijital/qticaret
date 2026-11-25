import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { cn } from "../lib/utils"
import type { DayRange } from "./day-range-filter"
import type {
  FilterDef,
  FilterOption,
  FilterValue,
  MultiFilter,
  SingleFilter,
} from "./filter-bar-model"
import { DaysPane, NumberPane } from "./filter-bar-inputs"

// A row of the menu: the height and hover of a dropdown's item, a keyboard user's thin outline
const ROW =
  "flex min-h-9 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"

// Above this many choices the list gets a box to narrow it (a category tree)
const SEARCH_FROM = 9

/** The menu's first view: every filter with what it is set to. */
export function FilterList({
  filters,
  summaries,
  onOpen,
}: {
  filters: readonly FilterDef[]
  summaries: ReadonlyMap<string, string | undefined>
  onOpen: (key: string) => void
}) {
  return (
    <div className="flex flex-col">
      {filters.map((filter) => {
        const summary = summaries.get(filter.key)
        return (
          <button
            key={filter.key}
            type="button"
            className={ROW}
            onClick={() => {
              onOpen(filter.key)
            }}
          >
            <span className="shrink-0 font-medium">{filter.label}</span>
            <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
              {summary ?? ""}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

/** One filter's view: back to the list, its choices, and a way to clear it. */
export function FilterPane({
  filter,
  value,
  active,
  onBack,
  onChange,
  onClose,
}: {
  filter: FilterDef
  value: FilterValue
  active: boolean
  onBack: () => void
  onChange: (next: FilterValue) => void
  onClose: () => void
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  // A typed number or days apply with their button, which also closes the menu
  const apply = (next: FilterValue) => {
    onChange(next)
    onClose()
  }
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("filterBar.back")}
          onClick={onBack}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="flex-1 truncate text-sm font-medium">{filter.label}</span>
        {active ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(undefined)
            }}
          >
            {t("common.clear")}
          </Button>
        ) : null}
      </div>
      {filter.kind === "single" || filter.kind === "multi" ? (
        <ChoiceList filter={filter} value={value} onChange={onChange} onClose={onClose} />
      ) : filter.kind === "number" ? (
        <NumberPane filter={filter} value={value as number | undefined} onApply={apply} />
      ) : filter.kind === "days" ? (
        <DaysPane value={value as DayRange | undefined} onApply={apply} />
      ) : (
        filter.render(onClose)
      )}
      {filter.hint ? <p className="px-2 text-xs text-muted-foreground">{filter.hint}</p> : null}
    </div>
  )
}

/** A filter's choices: one is picked and the menu closes, or several are ticked. */
function ChoiceList({
  filter,
  value,
  onChange,
  onClose,
}: {
  filter: SingleFilter | MultiFilter
  value: FilterValue
  onChange: (next: FilterValue) => void
  onClose: () => void
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const [text, setText] = useState("")
  const needle = text.trim().toLocaleLowerCase("tr")
  const shown = needle
    ? filter.options.filter((option) => option.label.toLocaleLowerCase("tr").includes(needle))
    : filter.options
  const picked = new Set(
    filter.kind === "multi" ? ((value ?? []) as readonly string[]) : [value as string]
  )
  const choose = (option: FilterOption) => {
    if (filter.kind === "single") {
      onChange(option.value)
      onClose()
      return
    }
    const next = filter.options
      .map((one) => one.value)
      .filter((one) => (one === option.value ? !picked.has(one) : picked.has(one)))
    onChange(next.length > 0 ? next : undefined)
  }
  return (
    <>
      {filter.options.length >= SEARCH_FROM ? (
        <Input
          type="search"
          value={text}
          placeholder={t("filterBar.findOption")}
          aria-label={t("filterBar.findOption")}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
      ) : null}
      <div
        className="flex max-h-72 min-h-0 flex-col overflow-y-auto"
        data-scroll-area="y"
        role="group"
        aria-label={filter.label}
      >
        {shown.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("filterBar.noOption")}</p>
        ) : null}
        {shown.map((option, index) => {
          const on = picked.has(option.value)
          const heading =
            option.group && option.group !== shown[index - 1]?.group ? option.group : null
          const indent = { paddingLeft: `${String(8 + (option.depth ?? 0) * 16)}px` }
          return (
            <div key={option.value} className="flex flex-col">
              {heading ? (
                <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                  {heading}
                </p>
              ) : null}
              {filter.kind === "multi" ? (
                <label className={cn(ROW, "cursor-pointer")} style={indent}>
                  <Checkbox
                    checked={on}
                    onCheckedChange={() => {
                      choose(option)
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </label>
              ) : (
                <button
                  type="button"
                  className={ROW}
                  style={indent}
                  aria-pressed={on}
                  onClick={() => {
                    choose(option)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Check
                    className={cn("size-4 shrink-0", on ? "opacity-100" : "opacity-0")}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
