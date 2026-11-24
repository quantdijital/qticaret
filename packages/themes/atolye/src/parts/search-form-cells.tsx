import { CalendarDays } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { SearchFormDayView, SearchFormSelectView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The search box's fields (adr/0077 §1), shared by the form and its dates
 * group (which the calendar turns on in the browser): no state, no
 * handlers of their own, so they draw the same on the server and in it.
 */

/** One field of the bar: its icon, its small label over a borderless control; a rule before it from 768 px. */
const CELL =
  "flex min-w-0 flex-1 items-center gap-3 border-t border-rule px-3 py-2.5 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0"
export const CONTROL =
  "w-full min-w-0 appearance-none truncate bg-transparent text-sm text-text-2 outline-none [color-scheme:light]"

export function Cell({
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

export function SelectCell({ icon, field }: { icon: LucideIcon; field: SearchFormSelectView }) {
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

export function DayCell({ field }: { field: SearchFormDayView }) {
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
