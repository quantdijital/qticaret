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

/**
 * Where the bar turns one row: from 768 px, or from 1024 px for a dated
 * search, whose six fields and button ran over each other in a 768 px row.
 */
export type BarFrom = "md" | "lg"

/**
 * One field of the bar: its icon, its small label over a borderless
 * control. On a phone each field is a framed box in a two-column grid;
 * once the bar is one row, a rule before it in the row.
 */
const CELL: Readonly<Record<BarFrom, string>> = {
  md: "flex min-w-0 flex-1 items-center gap-2 border border-rule px-2.5 py-2 md:gap-3 md:border-0 md:border-l md:px-3 md:py-2.5 md:first:border-l-0",
  lg: "flex min-w-0 flex-1 items-center gap-2 border border-rule px-2.5 py-2 lg:gap-3 lg:border-0 lg:border-l lg:px-3 lg:py-2.5 lg:first:border-l-0",
}

/** A date wide enough for its whole day (`gg.aa.yyyy` and the picker), and the flexible month for its whole name, once the bar is one row. */
export const DAY = "lg:min-w-40"
export const CONTROL =
  "w-full min-w-0 appearance-none truncate bg-transparent text-sm text-text-2 outline-none [color-scheme:light]"

export function Cell({
  icon: Icon,
  label,
  className,
  from = "md",
  children,
}: {
  icon: LucideIcon
  label: string
  className?: string | false | undefined
  from?: BarFrom | undefined
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        CELL[from],
        "cursor-pointer rounded-tile focus-within:outline-2 focus-within:outline-focus",
        className
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

export function SelectCell({
  icon,
  field,
  className,
  from,
}: {
  icon: LucideIcon
  field: SearchFormSelectView
  className?: string | false | undefined
  from?: BarFrom | undefined
}) {
  return (
    <Cell icon={icon} label={field.label} className={className} from={from}>
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

export function DayCell({
  field,
  className,
  from,
}: {
  field: SearchFormDayView
  className?: string | false | undefined
  from?: BarFrom | undefined
}) {
  return (
    <Cell icon={CalendarDays} label={field.label} className={cn(DAY, className)} from={from}>
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
