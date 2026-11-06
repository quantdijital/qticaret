import { useRef } from "react"
import type { ReactNode } from "react"
import { useTwoWaySticky } from "@/components/patterns/use-two-way-sticky"
import { cn } from "@/lib/utils"
import { SPANS } from "@/components/patterns/page-spans"
import type { Span } from "@/components/patterns/page-spans"

/**
 * The page's card layout (docs/18 §2, "Denge"): cells on one row stretch
 * to one height, and a column's last card grows so side-by-side columns end
 * on one line. A card that ends short of its neighbour leaves a gap the
 * eye reads as a mistake; `e2e/layout.e2e.ts` measures every page for it.
 */
export function PageGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-stretch gap-[var(--grid-gap)] xl:grid-cols-12",
        className
      )}
    >
      {children}
    </div>
  )
}

const COLUMN = "flex min-w-0 flex-col gap-[var(--grid-gap)]"

// The last card grows, also when it sits in an anchor wrapper (`<div id=...>`)
const GROW_LAST =
  "[&>:last-child]:flex-1 [&>div:last-child]:flex [&>div:last-child]:flex-col [&>div:last-child>section]:flex-1"

// Where a sticky column is held, in rem: under the window's top (the old `xl:top-20`) and over its bottom
const STICKY_ROOM = { top: 5, gap: 1.5 }

/**
 * A column of cards in a PageGrid. A sticky column (a form's summary and
 * save button, an editor's side cards) keeps its own height instead and
 * follows the scroll: one that fits the window stays under its top; a
 * taller one moves with the page until its end is in sight, scrolling
 * down, or its start, scrolling up, and is held there, so each of its
 * cards is reached and none is left behind (`useTwoWaySticky`). It never
 * scrolls inside. Below `xl` the columns stack and nothing sticks.
 */
export function PageColumn({
  span,
  sticky = false,
  className,
  children,
}: {
  span: Span
  sticky?: boolean
  className?: string
  children: ReactNode
}) {
  const cell = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useTwoWaySticky(cell, body, STICKY_ROOM, sticky)
  if (!sticky) {
    return <div className={cn(COLUMN, SPANS[span], GROW_LAST, className)}>{children}</div>
  }
  return (
    <div
      ref={cell}
      data-layout-free=""
      className={cn(
        COLUMN,
        "xl:block xl:min-h-[var(--sticky-height,auto)] xl:[contain:size]",
        SPANS[span],
        className
      )}
    >
      <div aria-hidden className="hidden xl:block xl:h-[var(--sticky-shift,0px)]" />
      <div
        ref={body}
        data-sticks=""
        className="max-xl:contents xl:sticky xl:top-[var(--sticky-top,5rem)] xl:bottom-[var(--sticky-bottom,auto)] xl:flex xl:flex-col xl:gap-[var(--grid-gap)]"
      >
        {children}
      </div>
    </div>
  )
}
