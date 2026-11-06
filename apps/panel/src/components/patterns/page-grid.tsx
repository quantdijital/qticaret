import { useRef } from "react"
import type { ReactNode } from "react"
import { useFitsView } from "@/components/patterns/use-fits-view"
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

// The last card grows, also when it sits in an anchor wrapper (`<div id=...>`)
const GROW_LAST =
  "[&>:last-child]:flex-1 [&>div:last-child]:flex [&>div:last-child]:flex-col [&>div:last-child>section]:flex-1"

// A sticky column's offset from the window's top (`xl:top-20`) and the margin kept under it, in rem
const STICKY_ROOM = 5 + 1.5

/**
 * A column of cards in a PageGrid. A sticky column (a form's summary and
 * save button, an editor's side cards) keeps its own height instead and
 * follows the scroll while it fits in the window; taller, it scrolls with
 * the page so each of its cards is reached. It never scrolls inside.
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
  const ref = useRef<HTMLDivElement>(null)
  const fits = useFitsView(ref, STICKY_ROOM, sticky)
  return (
    <div
      ref={ref}
      data-layout-free={sticky ? "" : undefined}
      data-sticks={sticky && fits ? "" : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-[var(--grid-gap)]",
        SPANS[span],
        sticky ? cn("xl:self-start", fits && "xl:sticky xl:top-20") : GROW_LAST,
        className
      )}
    >
      {children}
    </div>
  )
}
