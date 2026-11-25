import type { ReactNode } from "react"
import { PageColumn, PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { spanOf } from "@qticaret/admin-ui/lib/page-spans"
import { cn } from "@qticaret/admin-ui/lib/utils"

// A narrow fixed side column (the product page, WooCommerce's): beside the main one from `lg` up
const NARROW_GRID = "lg:grid-cols-[minmax(0,1fr)_17.5rem] xl:grid-cols-[minmax(0,1fr)_18.75rem]"
const ONE_CELL = "lg:col-span-1 xl:col-span-1"

/**
 * A text's page (content page, blog post, filter page; docs/06 "Metin
 * sayfaları") and a product's ("Ürün sayfası"): the main column leads
 * with what is edited most, its secondary parts folded under it; the narrow column beside holds the
 * short facts and the SEO advisor and follows the scroll; taller than the
 * window, it moves with the page until its end, or scrolling back its
 * start, is in sight and is held there (never scrolling inside itself,
 * the owner 2026-11-06), so each card is reached and none is left behind. Folding a part never leaves
 * a stretched card: the main column ends where its last card does.
 *
 * Below `xl` the narrow column comes under the main one. With `merge`
 * the two make one column there instead, each card placed by its own
 * `order` (a text's cover and summary before its folded search
 * appearance, the advisor last); side by side, each keeps its column.
 * With `narrowSide` the side column has a fixed width (280px, 300px from
 * `xl`) and stands beside the main one from `lg`, the main column taking
 * the rest; it follows the scroll from `xl`.
 */
export function EditorLayout({
  main,
  side,
  merge = false,
  narrowSide = false,
}: {
  main: ReactNode
  side: ReactNode
  merge?: boolean
  narrowSide?: boolean
}) {
  return (
    <PageGrid {...(narrowSide ? { className: NARROW_GRID } : {})}>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-[var(--grid-gap)]",
          merge && "max-xl:contents",
          spanOf(8),
          narrowSide && ONE_CELL
        )}
      >
        {main}
      </div>
      <PageColumn
        span={4}
        sticky
        className={cn(merge && "max-xl:contents", narrowSide && ONE_CELL)}
      >
        {side}
      </PageColumn>
    </PageGrid>
  )
}
