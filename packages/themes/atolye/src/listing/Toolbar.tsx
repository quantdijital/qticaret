import { ArrowDownUp, Check, SlidersHorizontal, X } from "lucide-react"
import type { ListingPageView, SortOptionView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { SheetOpener } from "./FilterSheet"
import { Menu } from "./Menu"

/** The sort as a small menu of links (never indexed: nofollow), the current one ticked. */
function Sort({
  options,
  current,
  t,
  className,
}: {
  options: readonly SortOptionView[]
  current: SortOptionView
  t: Translate
  className: string
}) {
  return (
    <Menu
      className={className}
      label={
        <span className="flex min-w-0 items-center gap-2">
          <ArrowDownUp className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          <span className="truncate">
            <span className="lg:hidden">{t("listing.sort_short")}</span>
            <span className="max-lg:hidden">{t("listing.sort_by", { label: current.label })}</span>
          </span>
        </span>
      }
    >
      <ul aria-label={t("listing.sort")} className="flex flex-col">
        {options.map((option) => (
          <li key={option.path}>
            <a
              href={option.path}
              rel="nofollow"
              aria-current={option.current ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-between gap-4 rounded-inner px-3 text-sm no-underline hover:bg-paper-2",
                option.current && "font-semibold"
              )}
            >
              {option.label}
              {option.current && (
                <Check className="size-4 shrink-0" aria-hidden="true" strokeWidth={2.5} />
              )}
            </a>
          </li>
        ))}
      </ul>
    </Menu>
  )
}

/**
 * The grid's head: how many products the list holds (the h2 the cards'
 * names sit under), the sort as a small menu of links and, on a phone,
 * the pill that opens the filter sheet with the number of filters on.
 * Under it what narrows the list now, each a dark pill that takes it
 * away, and one link that clears them all. Under 1024 px the filter and
 * sort pills stay pinned under the header while the grid scrolls by
 * (`frame.css`): the wrappers step aside (`contents`) so the pills are a
 * row of the list's own column, which holds the grid and the pages.
 */
export function Toolbar({
  view,
  t,
  sheet,
  results,
}: {
  view: ListingPageView
  t: Translate
  /** The filter sheet's id; none when the list offers no filter. */
  sheet: string | null
  /** The grid's anchor (the sheet's "show results" lands here). */
  results: string
}) {
  const current = view.sort.find((option) => option.current) ?? view.sort[0] ?? null
  const sort = current !== null && view.total > 1 ? current : null
  const on = view.active.length
  return (
    <div className="flex flex-col gap-4 max-lg:contents">
      <div className="max-lg:contents lg:flex lg:items-center lg:justify-between">
        <h2
          id={results}
          className="max-w-none scroll-mt-40 text-md font-semibold tracking-normal text-text-2"
        >
          {t("listing.count", { count: view.total })}
        </h2>
        {(sheet !== null || sort !== null) && (
          // The column's 24 px gap less the margins: 12 px under the count, 16 px to
          // the chips and 24 px to the grid, as before; its own fill hides the cards
          // that scroll under it
          <div
            data-gf-stick=""
            className={cn(
              "gf-listbar -mx-(--gutter) -mt-5 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 bg-paper px-(--gutter) py-2 data-js-stuck:shadow-[0_1px_0_var(--color-rule)] lg:contents",
              on > 0 ? "-mb-4" : "-mb-2"
            )}
          >
            {sheet && (
              <SheetOpener
                id={sheet}
                className="gf-chip justify-center rounded-button bg-paper-2 lg:hidden"
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" strokeWidth={2} />
                {t("listing.show_filters")}
                {on > 0 && (
                  <span className="tabular rounded-pill bg-mark px-2 text-2xs leading-5 text-mark-ink">
                    <span className="sr-only">: </span>
                    {on}
                  </span>
                )}
              </SheetOpener>
            )}
            {sort && (
              <Sort
                options={view.sort}
                current={sort}
                t={t}
                className={sheet ? "" : "col-span-2 justify-self-start"}
              />
            )}
          </div>
        )}
      </div>
      {on > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="sr-only">{t("listing.active")}</h3>
          <ul className="contents">
            {view.active.map((chip) => (
              <li key={chip.path}>
                <a
                  href={chip.path}
                  rel="nofollow"
                  aria-label={t("listing.remove_filter", { label: chip.label })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-mark pr-3 pl-4 text-sm font-semibold whitespace-nowrap text-mark-ink no-underline transition-colors duration-(--dur-micro) hover:bg-mark-deep active:translate-y-px"
                >
                  {chip.label}
                  <X className="size-4" aria-hidden="true" strokeWidth={2} />
                </a>
              </li>
            ))}
          </ul>
          {view.clearPath && (
            <a href={view.clearPath} rel="nofollow" className="gf-link px-2 text-sm">
              {t("listing.clear")}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
