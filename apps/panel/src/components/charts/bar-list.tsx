import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface BarListItem {
  key: string
  label: ReactNode
  value: number
  /** The value as shown at the bar's end. */
  display: string
  /** A second line under the label (units sold). */
  sub?: string
  /** Rest of the list in a quieter colour (Diğer, Kategorisiz). */
  muted?: boolean
}

/**
 * Ranked magnitudes as thin horizontal bars (dataviz: one series, one
 * colour): the label and value in text colours, the bar beside them, its
 * length against the largest. Values are printed, so nothing needs a hover.
 */
export function BarList({ items, className }: { items: BarListItem[]; className?: string }) {
  const max = Math.max(...items.map((item) => item.value), 0)
  return (
    <ul className={cn("flex flex-col gap-3.5", className)}>
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="tabular shrink-0 font-medium">{item.display}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", item.muted ? "bg-chart-muted" : "bg-chart-1")}
              style={{ width: `${String(max > 0 ? (item.value / max) * 100 : 0)}%` }}
            />
          </div>
          {item.sub ? <span className="text-xs text-muted-foreground">{item.sub}</span> : null}
        </li>
      ))}
    </ul>
  )
}
