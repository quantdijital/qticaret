import type { PaginationView, Translate } from "@qticaret/ui"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@qticaret/ui/components/pagination"

/** The page numbers shown: the first, the last, and two on each side of the current one. */
export function visiblePages(page: number, pages: number): (number | "gap")[] {
  const shown: (number | "gap")[] = []
  for (let each = 1; each <= pages; each++) {
    if (each === 1 || each === pages || Math.abs(each - page) <= 2) {
      shown.push(each)
    } else if (shown.at(-1) !== "gap") {
      shown.push("gap")
    }
  }
  return shown
}

/** A listing's pages as real links (docs/13 §7: each page has its own address). */
export function Pages({ pagination, t }: { pagination: PaginationView; t: Translate }) {
  if (pagination.pages <= 1) {
    return null
  }
  return (
    <Pagination aria-label={t("listing.pages")} className="mt-4">
      <PaginationContent className="flex-wrap justify-center">
        {pagination.previous && (
          <PaginationItem>
            <PaginationPrevious href={pagination.previous} label={t("listing.previous")} />
          </PaginationItem>
        )}
        {visiblePages(pagination.page, pagination.pages).map((each, index) =>
          each === "gap" ? (
            <PaginationItem key={`gap-${String(index)}`}>
              <PaginationEllipsis label={t("listing.more_pages")} />
            </PaginationItem>
          ) : (
            <PaginationItem key={each}>
              {pagination.pagePath[each] ? (
                <PaginationLink
                  href={pagination.pagePath[each]}
                  isActive={each === pagination.page}
                  aria-label={t("listing.page_n", { page: each })}
                >
                  {each}
                </PaginationLink>
              ) : (
                <span className="px-2 text-sm text-muted-foreground">{each}</span>
              )}
            </PaginationItem>
          )
        )}
        {pagination.next && (
          <PaginationItem>
            <PaginationNext href={pagination.next} label={t("listing.next")} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
