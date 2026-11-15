import type { ReactNode } from "react"
import { sectionMark } from "@qticaret/ui"
import type { SectionDeviceView, SectionLookView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A section's look (adr/0049 Ek 2026-11-14 §6) in this theme: a box around
 * the section that names each step the shop set (`data-outer`, `data-inner`,
 * `data-ground`, `data-align`, `data-width`); `look.css` maps them onto the
 * theme's own scale (section gaps, the spacing scale, its measured grounds,
 * the container). No inline style: the steps are attributes, the values
 * tokens. A section the shop left to the theme gets no box at all, so it
 * draws exactly as before looks. The dark stage takes the theme's own
 * `gf-stage` (its buttons, fields and focus ring on graphite). A page's
 * main section (`main`: the product's block, the category's grid) keeps
 * the gaps between its own parts; only a home section gives its top gap
 * to the box.
 *
 * The screens it shows on (docs/tema/bilesen-standardi §2) ride the same
 * box (`data-show-on`); a section shown everywhere with no look set gets
 * none. `look.css` hides it at the theme's frame breakpoint (64rem), so
 * every visitor gets the same page and a lazy picture in it is not fetched.
 *
 * With the section's `id` the box always stands and carries its mark
 * (`sectionMark`, adr/0065 §4): a plain box, so the page draws as before.
 */
export function Look({
  id,
  look,
  device,
  main = false,
  children,
}: {
  /** The section's id: its mark on the box (adr/0065 §4). */
  id?: string | undefined
  look: SectionLookView | undefined
  device?: SectionDeviceView | undefined
  main?: boolean
  children: ReactNode
}) {
  const looked = look !== undefined && Object.keys(look).length > 0
  if (!looked) {
    return device || id ? (
      <div className={device ? "gf-device" : undefined} data-show-on={device} {...sectionMark(id)}>
        {children}
      </div>
    ) : (
      children
    )
  }
  return (
    <div
      className={cn("group/look gf-look", look.ground === "stage" && "gf-stage")}
      data-outer={look.space_outer}
      data-inner={look.space_inner}
      data-ground={look.ground}
      data-align={look.align}
      data-width={look.width}
      data-main={main ? "" : undefined}
      data-show-on={device}
      {...sectionMark(id)}
    >
      {children}
    </div>
  )
}
