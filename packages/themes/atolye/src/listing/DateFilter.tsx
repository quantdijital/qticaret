import { ChevronDown } from "lucide-react"
import type { DateFilterView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A dated shop's departure months, as a filled well like the other
 * filters: each month a link (nofollow) that asks it or lets it go, one
 * at a time, so each row wears a round mark. No counts: a month's
 * departures are counted by the list it opens.
 */
export function DateFilter({ dates, hash }: { dates: DateFilterView; hash: string }) {
  const chosen = dates.options.some((option) => option.selected)
  return (
    <details open className="group/filter rounded-media gf-box px-2 py-1">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-inner px-2 text-md font-semibold">
        <span>
          {dates.label}
          {chosen && <span className="tabular ml-2 text-sm font-semibold text-text-3">(1)</span>}
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-text-3 transition-transform duration-(--dur-short) group-open/filter:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ul className="flex flex-col pb-2">
        {dates.options.map((option) => (
          <li key={option.path}>
            <a
              href={hash ? `${option.path}#${hash}` : option.path}
              rel="nofollow"
              aria-current={option.selected ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-inner px-2 text-sm no-underline transition-colors hover:bg-paper-3",
                option.selected && "font-semibold"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-pill border transition-colors",
                  option.selected ? "border-text bg-text" : "border-edge bg-field"
                )}
              >
                {option.selected && <span className="size-2 rounded-pill bg-paper" />}
              </span>
              <span className="min-w-0 flex-1">{option.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}
