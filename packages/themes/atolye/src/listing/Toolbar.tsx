import { ArrowDownUp, Check, SlidersHorizontal, X } from "lucide-react"
import type { ListingPageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { SheetOpener } from "./FilterSheet"
import { Menu } from "./Menu"

/**
 * The grid's head: how many products the list holds (the h2 the cards'
 * names sit under), the sort as a small menu of links (never indexed:
 * nofollow) and, on a phone, the pill that opens the filter sheet with
 * the number of filters on. Under it what narrows the list now, each a
 * dark pill that takes it away, and one link that clears them all.
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
  const on = view.active.length
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] items-center gap-x-2 gap-y-3 lg:flex lg:justify-between">
        <h2
          id={results}
          className="col-span-2 max-w-none scroll-mt-40 text-md font-semibold tracking-normal text-text-2"
        >
          {t("listing.count", { count: view.total })}
        </h2>
        {sheet && (
          <SheetOpener id={sheet} className="gf-chip justify-center bg-paper-2 lg:hidden">
            <SlidersHorizontal className="size-4" aria-hidden="true" strokeWidth={2} />
            {t("listing.show_filters")}
            {on > 0 && (
              <span className="tabular rounded-pill bg-text px-2 text-2xs leading-5 text-paper">
                <span className="sr-only">: </span>
                {on}
              </span>
            )}
          </SheetOpener>
        )}
        {current && view.total > 1 && (
          <Menu
            className={sheet ? "" : "col-span-2 justify-self-start"}
            label={
              <span className="flex min-w-0 items-center gap-2">
                <ArrowDownUp className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
                <span className="truncate">
                  <span className="lg:hidden">{t("listing.sort_short")}</span>
                  <span className="max-lg:hidden">
                    {t("listing.sort_by", { label: current.label })}
                  </span>
                </span>
              </span>
            }
          >
            <ul aria-label={t("listing.sort")} className="flex flex-col">
              {view.sort.map((option) => (
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-text pr-3 pl-4 text-sm font-semibold whitespace-nowrap text-paper no-underline transition-colors duration-(--dur-micro) hover:bg-text-2 active:translate-y-px"
                >
                  {chip.label}
                  <X className="size-4" aria-hidden="true" strokeWidth={2.25} />
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
