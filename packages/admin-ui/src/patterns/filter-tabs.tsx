import type { ReactNode } from "react"
import { cn } from "../lib/utils"

export interface FilterTab<K extends string> {
  key: K
  label: string
  count?: number | undefined
}

interface FilterTabsProps<K extends string> {
  tabs: FilterTab<K>[]
  value: K
  onChange: (value: K) => void
  label: string
  /**
   * Controls at the row's right end (a list without a search: its
   * "Filtrele" button). They never squeeze the tabs: on a narrow screen
   * the tabs wrap and the controls stay at the end.
   */
  end?: ReactNode
}

/**
 * Quick views of a list (all, published, drafts…): an underlined tab row
 * with counts. The tabs wrap on a narrow screen rather than scroll
 * sideways (as PageTabs): a scrolling row showed a scrollbar for the
 * underline's one pixel below the line (the owner, 2026-11-24).
 */
export function FilterTabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  end,
}: FilterTabsProps<K>) {
  const list = (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex flex-wrap gap-x-1", end ? "min-w-0 flex-1" : "border-b px-3")}
    >
      {tabs.map((tab) => {
        const selected = tab.key === value
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(tab.key)
            }}
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-2 px-3 text-sm transition-colors",
              "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full",
              selected
                ? "font-medium text-foreground after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-xs",
                  selected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
  if (!end) {
    return list
  }
  return (
    <div className="flex items-end gap-2 border-b px-3" data-filter-tabs-end="">
      {list}
      <div className="flex h-11 shrink-0 items-center gap-2 pr-2">{end}</div>
    </div>
  )
}
