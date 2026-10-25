import { cn } from "@/lib/utils"

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
}

/** Quick views of a list (all, published, drafts…): an underlined tab row with counts. */
export function FilterTabs<K extends string>({ tabs, value, onChange, label }: FilterTabsProps<K>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b px-3">
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
}
