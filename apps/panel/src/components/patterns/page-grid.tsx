import type { ReactNode } from "react"
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

/**
 * A column of cards in a PageGrid. A sticky column (a form's summary and
 * save button, following the scroll) keeps its own height instead.
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
  return (
    <div
      data-layout-free={sticky ? "" : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-[var(--grid-gap)]",
        SPANS[span],
        sticky ? "xl:sticky xl:top-20 xl:self-start" : GROW_LAST,
        className
      )}
    >
      {children}
    </div>
  )
}
