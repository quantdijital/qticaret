import { ChevronLeft, ChevronRight } from "lucide-react"
import type { PaginationView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** The page numbers shown: the first, the last, and one on each side of the current one. */
export function visiblePages(page: number, pages: number): (number | "gap")[] {
  const shown: (number | "gap")[] = []
  for (let each = 1; each <= pages; each++) {
    if (each === 1 || each === pages || Math.abs(each - page) <= 1) {
      shown.push(each)
    } else if (shown.at(-1) !== "gap") {
      shown.push("gap")
    }
  }
  return shown
}

const STEP = "gf-btn gf-btn--quiet gf-btn--small gap-1"

/**
 * A listing's pages as real links (docs/13 §7: each page its own
 * address, crawlable, no script): the previous and next as quiet pills,
 * the numbers between as 44 px circles, the current one dark; where the
 * page is said in words above them.
 */
export function Pager({ pagination, t }: { pagination: PaginationView; t: Translate }) {
  if (pagination.pages <= 1) {
    return null
  }
  return (
    <nav aria-label={t("listing.pages")} className="flex flex-col items-center gap-4">
      <p className="text-sm text-text-3">
        {t("listing.page_of", { page: pagination.page, pages: pagination.pages })}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {pagination.previous && (
          <li>
            <a href={pagination.previous} rel="prev" className={STEP}>
              <ChevronLeft className="size-4" aria-hidden="true" strokeWidth={2} />
              {t("listing.previous")}
            </a>
          </li>
        )}
        {visiblePages(pagination.page, pagination.pages).map((each, index) => (
          <li key={each === "gap" ? `gap-${String(index)}` : each} className="max-sm:hidden">
            {each === "gap" ? (
              <span
                aria-hidden="true"
                className="inline-flex size-11 items-center justify-center text-text-3"
              >
                …
              </span>
            ) : (
              <a
                href={pagination.pagePath[each] ?? "#"}
                aria-current={each === pagination.page ? "page" : undefined}
                aria-label={t("listing.page_n", { page: each })}
                className={cn(
                  "tabular inline-flex size-11 items-center justify-center rounded-button text-sm font-semibold no-underline transition-colors duration-(--dur-micro)",
                  each === pagination.page ? "bg-text text-paper" : "bg-paper-2 hover:bg-paper-3"
                )}
              >
                {each}
              </a>
            )}
          </li>
        ))}
        {pagination.next && (
          <li>
            <a href={pagination.next} rel="next" className={STEP}>
              {t("listing.next")}
              <ChevronRight className="size-4" aria-hidden="true" strokeWidth={2} />
            </a>
          </li>
        )}
      </ul>
    </nav>
  )
}
