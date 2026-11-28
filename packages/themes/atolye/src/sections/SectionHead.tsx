import { TitleText } from "../parts/TitleText"
import { fieldMark } from "@qticaret/ui"
import type { HeadLinesView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { HeadNote, HeadEyebrow } from "./head-lines"

/**
 * A section's head: its h2 on the left, the link to the whole list on
 * the right on the h2's baseline (Tezgâh audit Y-07; a destination, never
 * a label above the head). `children` sits under the head (a tab row). In a section the shop
 * centred (its look, `Look.tsx`) the link stands under the centred head.
 *
 * `lines` (sahip 2026-11-28): the small upper-case line over the h2 and
 * the hand note right after it (under it on a narrow screen), each only
 * once the shop wrote it; without either the head is as it was.
 */
export function SectionHead({
  id,
  title,
  more,
  className,
  marks,
  ownMore = false,
  lines,
}: {
  id: string
  title: string
  more?: LinkView | null
  className?: string
  /** The editor's live preview (adr/0065 Faz 2b): the title carries its field mark. */
  marks?: boolean | undefined
  /** The link is the shop's own (`more`, a field of its form): in the preview it is marked too. */
  ownMore?: boolean
  /** The heading's upper line and hand note; absent or empty: not drawn. */
  lines?: HeadLinesView | undefined
}) {
  const heading = (
    <h2 id={id} {...fieldMark(marks, "title")}>
      <TitleText text={title} />
    </h2>
  )
  const link = more && (
    <a
      href={more.path}
      className="gf-link shrink-0 text-sm lg:text-md"
      {...fieldMark(marks && ownMore, "more")}
    >
      {more.label}
    </a>
  )
  if (!lines?.eyebrow && !lines?.note) {
    return (
      <div
        className={cn(
          "flex items-baseline justify-between gap-4 group-data-[align=center]/look:flex-col group-data-[align=center]/look:items-center group-data-[align=center]/look:gap-1 group-data-[align=center]/look:text-center",
          className
        )}
      >
        {heading}
        {link}
      </div>
    )
  }
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-4 group-data-[align=center]/look:flex-col group-data-[align=center]/look:items-center group-data-[align=center]/look:gap-1 group-data-[align=center]/look:text-center",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 group-data-[align=center]/look:items-center">
        <HeadEyebrow lines={lines} marks={marks} />
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1 group-data-[align=center]/look:justify-center">
          {heading}
          <HeadNote lines={lines} marks={marks} />
        </div>
      </div>
      {link}
    </div>
  )
}
