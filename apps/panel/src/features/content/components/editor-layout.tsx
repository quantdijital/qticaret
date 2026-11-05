import type { ReactNode } from "react"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { spanOf } from "@/components/patterns/page-spans"
import { cn } from "@/lib/utils"

/**
 * A text's page (content page, blog post, filter page; docs/06 "Metin
 * sayfaları"): the main column leads with the title and the editor, its
 * secondary parts folded under them; the narrow column beside holds the
 * short facts and the SEO advisor and follows the scroll, scrolling
 * inside when it is taller than the window. Folding a part never leaves
 * a stretched card: the main column ends where its last card does.
 */
export function EditorLayout({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <PageGrid>
      <div className={cn("flex min-w-0 flex-col gap-[var(--grid-gap)]", spanOf(8))}>{main}</div>
      <PageColumn
        span={4}
        sticky
        // A pixel under the last card, so its shadow is not cut where the column scrolls
        className="xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:overscroll-contain xl:pb-px"
      >
        {side}
      </PageColumn>
    </PageGrid>
  )
}
