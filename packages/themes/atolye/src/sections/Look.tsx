import type { ReactNode } from "react"
import type { SectionLookView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A section's look (adr/0049 Ek 2026-11-14 §6) in this theme: a box around
 * the section that names each step the shop set (`data-outer`, `data-inner`,
 * `data-ground`, `data-align`, `data-width`); `look.css` maps them onto the
 * theme's own scale (section gaps, the spacing scale, its measured grounds,
 * the container). No inline style: the steps are attributes, the values
 * tokens. A section the shop left to the theme gets no box at all, so it
 * draws exactly as before looks. The dark stage takes the theme's own
 * `gf-stage` (its buttons, fields and focus ring on graphite).
 */
export function Look({
  look,
  children,
}: {
  look: SectionLookView | undefined
  children: ReactNode
}) {
  if (!look || Object.keys(look).length === 0) {
    return children
  }
  return (
    <div
      className={cn("group/look gf-look", look.ground === "stage" && "gf-stage")}
      data-outer={look.space_outer}
      data-inner={look.space_inner}
      data-ground={look.ground}
      data-align={look.align}
      data-width={look.width}
    >
      {children}
    </div>
  )
}
