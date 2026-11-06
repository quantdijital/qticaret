import type { ReactNode } from "react"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { spanOf } from "@/components/patterns/page-spans"
import { cn } from "@/lib/utils"

/**
 * A text's page (content page, blog post, filter page; docs/06 "Metin
 * sayfaları") and a product's ("Ürün sayfası"): the main column leads
 * with what is edited most, its secondary parts folded under it; the narrow column beside holds the
 * short facts and the SEO advisor and follows the scroll, scrolling
 * inside when it is taller than the window. Folding a part never leaves
 * a stretched card: the main column ends where its last card does.
 *
 * Below `xl` the narrow column comes under the main one. With `merge`
 * the two make one column there instead, each card placed by its own
 * `order` (a text's cover and summary before its folded search
 * appearance, the advisor last); side by side, each keeps its column.
 */
export function EditorLayout({
  main,
  side,
  merge = false,
}: {
  main: ReactNode
  side: ReactNode
  merge?: boolean
}) {
  return (
    <PageGrid>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-[var(--grid-gap)]",
          merge && "max-xl:contents",
          spanOf(8)
        )}
      >
        {main}
      </div>
      <PageColumn
        span={4}
        sticky
        // A pixel under the last card, so its shadow is not cut where the column scrolls
        className={cn(
          "xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:pb-px",
          merge && "max-xl:contents"
        )}
      >
        {side}
      </PageColumn>
    </PageGrid>
  )
}
