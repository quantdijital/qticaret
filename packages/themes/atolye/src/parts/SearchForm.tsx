import { LayoutGrid, MapPin, Search, Users } from "lucide-react"
import type { SearchFormSelectView, SearchFormView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { CONTROL, Cell, SelectCell } from "./search-form-cells"
import { SearchDates } from "./SearchDates"

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
          {form.dates && <SearchDates dates={form.dates} />}
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
