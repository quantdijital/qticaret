import { LayoutGrid, List } from "lucide-react"
import type { ListingViewSwitchView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The grid/list switch beside the sort: a plain GET form (no script), the
 * page's other parameters hidden in it, its two icon buttons writing
 * `gorunum`; the one on says so (`aria-pressed`), each names itself to a
 * screen reader and on hover. As tall as the sort's pill (44 px).
 */
export function ViewSwitch({
  view,
  className = "",
}: {
  view: ListingViewSwitchView
  className?: string
}) {
  return (
    <form
      action={view.action}
      method="get"
      role="group"
      aria-label={view.label}
      className={cn("flex items-center gap-1 rounded-button gf-box p-1", className)}
    >
      {view.keep.map((field, index) => (
        <input
          key={`${field.name}-${String(index)}`}
          type="hidden"
          name={field.name}
          value={field.value}
        />
      ))}
      {view.options.map((option) => (
        <button
          key={option.mode}
          type="submit"
          name={view.name}
          value={option.value}
          aria-pressed={option.current}
          aria-label={option.label}
          title={option.label}
          className={cn(
            "flex size-9 items-center justify-center rounded-inner transition-colors duration-(--dur-micro)",
            option.current ? "bg-text text-paper" : "text-text-2 hover:bg-paper-3 hover:text-text"
          )}
        >
          {option.mode === "grid" ? (
            <LayoutGrid className="size-4" aria-hidden="true" strokeWidth={2} />
          ) : (
            <List className="size-4" aria-hidden="true" strokeWidth={2} />
          )}
        </button>
      ))}
    </form>
  )
}
