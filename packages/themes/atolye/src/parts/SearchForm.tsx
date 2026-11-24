import { CalendarDays, CalendarRange, LayoutGrid, MapPin, Search, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { SearchFormDayView, SearchFormSelectView, SearchFormView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** One field of the bar: its icon, its small label over a borderless control; a rule before it from 768 px. */
const CELL =
  "flex min-w-0 flex-1 items-center gap-3 border-t border-rule px-3 py-2.5 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0"
const CONTROL =
  "w-full min-w-0 appearance-none truncate bg-transparent text-sm text-text-2 outline-none [color-scheme:light]"

function Cell({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        CELL,
        "cursor-pointer rounded-tile focus-within:outline-2 focus-within:outline-focus"
      )}
    >
      <Icon className="size-5 shrink-0 text-text-3" aria-hidden="true" strokeWidth={1.75} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold text-text">{label}</span>
        {children}
      </span>
    </label>
  )
}

function SelectCell({ icon, field }: { icon: LucideIcon; field: SearchFormSelectView }) {
  return (
    <Cell icon={icon} label={field.label}>
      <select name={field.name} defaultValue={field.value} className={CONTROL}>
        {field.anyLabel !== null && <option value="">{field.anyLabel}</option>}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Cell>
  )
}

function DayCell({ field }: { field: SearchFormDayView }) {
  return (
    <Cell icon={CalendarDays} label={field.label}>
      <input
        type="date"
        name={field.name}
        defaultValue={field.value}
        min={field.min}
        max={field.max}
        className={CONTROL}
      />
    </Cell>
  )
}

/**
 * The categories as tabs over the bar (`category_style: tabs`, Wanderly's
 * look): a radio group, so it works without JavaScript and the arrow keys
 * move along it; the chosen one underlined in the ink.
 */
function CategoryTabs({ field }: { field: SearchFormSelectView }) {
  const choices = [{ value: "", label: field.anyLabel ?? "" }, ...field.options]
  return (
    <fieldset className="flex flex-wrap gap-x-1 border-b border-rule px-2">
      <legend className="sr-only">{field.label}</legend>
      {choices.map((choice) => (
        <label key={choice.value || "-"} className="relative cursor-pointer">
          <input
            type="radio"
            name={field.name}
            value={choice.value}
            defaultChecked={field.value === choice.value}
            className="peer sr-only"
          />
          <span className="block px-3 py-3 text-sm font-semibold text-text-2 peer-checked:text-text peer-checked:shadow-[inset_0_-2px_0_currentColor] peer-focus-visible:outline-2 peer-focus-visible:outline-focus hover:text-text">
            {choice.label}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/**
 * The shop's one search box (adr/0077 §1; Pomaii's bar): a plain GET form
 * on a raised white panel, its fields side by side from 768 px with a
 * hairline between them, each an icon and a small label over its control,
 * the dark "Ara" button at the end; on a phone one field under another and
 * the button full width. The categories either a field of the bar or, as
 * tabs, over it. Every field is the view's: a null one is not drawn, and
 * every name and word comes with it.
 */
export function SearchForm({ form, className }: { form: SearchFormView; className?: string }) {
  const tabs = form.category?.style === "tabs" ? form.category : null
  const select = form.category?.style === "select" ? form.category : null
  return (
    <form
      action={form.action}
      method="get"
      role="search"
      aria-label={form.label}
      className={cn(
        "rounded-tile border border-rule bg-field text-left text-text shadow-float-edged",
        className
      )}
    >
      {form.hidden.map((field) => (
        <input key={field.name} type="hidden" name={field.name} value={field.value} />
      ))}
      {tabs && <CategoryTabs field={tabs} />}
      <div className="flex flex-col gap-2 p-2 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch">
          {form.words && (
            <Cell icon={Search} label={form.words.label}>
              <input
                type="search"
                name={form.words.name}
                defaultValue={form.words.value}
                placeholder={form.words.placeholder}
                maxLength={100}
                className={cn(CONTROL, "placeholder:text-placeholder")}
              />
            </Cell>
          )}
          {select && <SelectCell icon={LayoutGrid} field={select} />}
          {form.where && <SelectCell icon={MapPin} field={form.where} />}
          {form.dates && (
            <div
              role="group"
              aria-label={form.dates.label}
              className="flex min-w-0 flex-col border-t border-rule md:flex-[2.4] md:flex-row md:border-t-0 md:border-l"
            >
              <DayCell field={form.dates.from} />
              <DayCell field={form.dates.to} />
              <SelectCell icon={CalendarRange} field={form.dates.month} />
            </div>
          )}
          {form.people && <SelectCell icon={Users} field={form.people} />}
        </div>
        <button type="submit" className="gf-btn shrink-0 gap-2 md:self-stretch">
          <Search className="size-4.5" aria-hidden="true" strokeWidth={2} />
          {form.submit}
        </button>
      </div>
    </form>
  )
}
